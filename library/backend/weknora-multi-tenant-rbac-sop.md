# SOP: 企业级多租户工作空间隔离与 RBAC 成员治理设计 (Go + PostgreSQL)

> **编号**: SOP-BACKEND-001
> **分类**: 后端与服务架构 (`backend`)
> **标签**: 多租户, RBAC, 数据隔离, 成员邀请
> **核心栈**: Go, Gin, GORM, PostgreSQL, JWT(HMAC-SHA256), tenant_members, creator_id 归属守卫
> **解决痛点**: SaaS/知识库产品从「单人即管理员」升级到多空间协作时，租户串数据、人人自动开个人空间、平台超管与空间 Owner 混权、最后一位 Owner 被删导致空间锁死、邀请与公开注册闸门不一致。
> **复用定位**: 适用于任何「User 可属多个工作空间 → 空间是资源与配额隔离边界 → 空间内 RBAC + 资源归属 → 邀请制开户 → 组织共享必须正交且不可绕过空间门禁」的企业后端。

---

## 1. 从 0 到 1 标准执行路径 (0-to-1 SOP)

1. **阶段 1：先钉死隔离边界，再谈功能**
   - 把 **Tenant（工作空间）** 定义为唯一资源隔离单元：知识库、模型、Agent、会话、配额、API Key 全部挂 `tenant_id`。User 只是登录主体（email 唯一），**不是**隔离边界。
   - 成员关系必须走独立表 `tenant_members(user_id, tenant_id, role, status)`，一人可同时属于多个空间；`users.tenant_id` 只表示「首选/默认空间」，禁止当成唯一成员来源。
   - Access JWT 必须把当前 `tenant_id` 写进 claims；**切换空间 = 校验 active 成员资格后换发新 token**，并撤销旧 refresh。所有仓储查询默认强制 `WHERE tenant_id = 当前激活空间`，跨空间列表必须另开受控端点。
   - URL 中的 `:id` 必须与 token 激活空间一致（`PathTenantMatch`）；超级用户除外，且超级用户必须「用户标志 + 部署开关」双开才生效。

2. **阶段 2：空间内 RBAC 与资源归属两套守卫同时落地**
   - 角色阶梯固定四级：`viewer(10) < contributor(20) < admin(30) < owner(40)`，高角色继承低角色。Owner **至少一位、可以多位**；删空间、管 API Key、增删改成员/发邀请 = Owner 独有（Admin 也不能管人）。
   - 关键资源表加 `creator_id`。守卫分两类：
     - **角色守卫**：基础设施（模型、向量库、存储、IM/MCP）用 `Admin()`；创建入口用 `Contributor()`；纯读用 `Viewer()`。
     - **归属守卫** `OwnedXxxOrAdmin`：Contributor 只能改自己的 KB/Agent；他人资源按 Viewer；空 `creator_id` 视为空间共有，仅 Admin+ 可改。
   - 子资源必须沿 `chunk → knowledge → kb → creator_id` 回溯，禁止在 FAQ/Tag/Wiki 上另开一套门禁轴。
   - API Key 是**机器主体**，不复用角色阶梯：按 capabilities + KB allow-list 鉴权，空间内合成身份固定 Admin（删空间除外）。Platform Key 与 Tenant Key 分 scope，Tenant Key 不得碰 `/system/admin/*`。

3. **阶段 3：开户与建空间策略按企业场景一次配齐**
   - 两个正交开关，不要揉成一个：
     - `auth.registration_mode`：`self_serve`（公开注册）/ `invite_only`（挡密码自助注册）。
     - `auth.default_tenant_mode`：`create_personal`（新用户自动建个人空间并当 Owner）/ `tenantless`（只建号，等邀请进已有空间）。
   - 企业默认组合：`invite_only` + `tenantless` + 关闭 `tenant.self_service_creation_enabled`。这样员工不会每人一个个人空间，也不能自己开新空间。
   - 自助创建开关必须前后端同源解析（`/auth/me` 投影与 `POST /tenants` 执法共用同一函数），禁止 UI 显示「可创建」而 API 403。
   - 配置优先级要写死：`system_settings` 数据库行 > 启动合成的 cfg > 硬编码兜底。界面改过的键会盖掉环境变量；回到 env 必须删除该 setting 行。

4. **阶段 4：邀请闭环 + 最后 Owner 保护 + 与「共享组织」正交**
   - 三条进人路径都要打通：Owner 按邮箱直接加已有用户；定向邀请（pending→accepted/declined/revoked/expired）；共享邀请链接 + `POST /auth/register-by-invite`（invite_only 下唯一密码开户口）。邀请 lookup 用 **POST + body**，禁止 token 进 URL/访问日志。
   - 降级或移除 Owner 时，若会导致空间失去最后一位活跃 Owner → 拒绝。API Key-only 的孤儿空间：首位认证真人自动晋升 Owner，避免锁死。
   - **Organization（共享空间）不是租户**：成员单位是「整个 Tenant」，只记录跨空间共享关系，不持有 KB/Agent。跨空间写操作必须同时穿过：共享权限 ∩ 组织角色 ∩ **源空间 RBAC**。共享不得改变 `tenant_id` / `creator_id`。
   - 三层身份严禁混用：空间 Owner ≠ 平台 `IsSystemAdmin` ≠ 跨空间超管 `CanAccessAllTenants`。系统管理员默认看不到别人空间的知识库。

---

## 2. 踩坑与返工自查清单 (Pitfalls & Checklist)

- [x] **踩坑 1：用 `users.tenant_id` 当成员表**
  *原因*：一人多空间后，默认字段只能表示「上次/首选」，漏掉其余 membership。
  *解法*：登录响应返回 `memberships[]`；鉴权、列表、切换一律查 `tenant_members` 且 `status=active`。

- [x] **踩坑 2：认证成功 = 空间管理员**
  *原因*：单人自部署时期 JWT/API Key 通过即全权，团队一进来就会互删知识库。
  *解法*：认证之上叠加 RBAC；`tenant.enable_rbac` 默认强制；灰度可先 `false`（只记不拦），切强制前核对成员回填与 `[rbac] role insufficient` 日志。

- [x] **踩坑 3：把组织共享当成「加入空间」**
  *原因*：产品文案都叫「空间」，实现上一个是人进 Tenant，一个是 Tenant 进 Organization。
  *解法*：拉同事共用同一套库和配额 → 邀请加入 Tenant；两个已有空间互相借 KB → 建 Organization 再共享。写路径取 `Min(共享权限, 组织角色)` 再被租户 Viewer 封顶。

- [x] **踩坑 4：系统管理员被当成企业目录管理员**
  *原因*：`IsSystemAdmin` 管部署控制面（全局设置、队列、平台 Key），不管把全员编进某个公司空间。
  *解法*：进人靠空间 Owner 邀请或 `POST /tenants/:id/members`；跨空间看数据还需 `CanAccessAllTenants` **且** `enable_cross_tenant_access=true`。

- [x] **踩坑 5：改了 `DISABLE_REGISTRATION` 但注册仍开着**
  *原因*：该 env 只在启动时改写 cfg；请求时 `system_settings.auth.registration_mode` 优先。控制台开过 `self_serve` 后 env 失效。
  *解法*：以数据库设置为准；要回到 env 执行 `DELETE /system/admin/settings/auth.registration_mode`。`invite_only` 挡不住邀请注册端点。

- [x] **踩坑 6：删除最后一位 Owner / 回滚 RBAC 迁移**
  *原因*：空间失去控制面；`down.sql` 会丢掉 `tenant_members` 与 `audit_logs`。
  *解法*：服务端拒绝「最后 Owner」变更；回滚只用 `WEKNORA_TENANT_ENABLE_RBAC=false`，不要 down 迁移。

- [x] **踩坑 7：仓储漏 `tenant_id` 或子资源另开门禁**
  *原因*：按主键直取即可读到其他空间数据；FAQ/Tag 不沿 KB `creator_id` 回溯会让 Contributor 改到别人的库。
  *解法*：仓储默认作用域；越权返回 404 而非 403（避免探测）；子资源一律继承父 KB 守卫。

---

## 3. 面向 AI 的系统铁律 (Agent Instructions)

1. **Never**：严禁在仓储/handler 中按资源主键直取而不带当前 `tenant_id`（或未经 KB 访问守卫改写后的有效租户）。
2. **Never**：严禁把 Organization 共享、平台 `IsSystemAdmin`、跨空间 `CanAccessAllTenants` 做成「隐式空间 Admin」。三者与 `tenant_members.role` 正交，缺一闸口即越权。
3. **Never**：严禁移除或降级会导致空间失去最后一位活跃 Owner 的操作；严禁回滚已落地的 `tenant_members` / `creator_id` 迁移。
4. **Never**：严禁让 Admin 拥有成员治理权；增删成员、改角色、发邀请、管 API Key、删空间必须 Owner。
5. **Always**：一人多空间用 `tenant_members`；JWT 的 `tenant_id` 必须与激活空间一致，切换空间必须换发 token。
6. **Always**：企业落地默认 `invite_only` + `tenantless` + 关闭自助建空间；`/auth/me` 能力投影与 `POST /tenants` 执法必须同一解析函数。
7. **Always**：Contributor 写操作走 `OwnedXxxOrAdmin`；租户级基础设施走 `Admin()`；子资源继承父 KB 的 `creator_id`。
8. **Always**：邀请 token 走 POST body；成员/角色/邀请全生命周期写审计（`rbac.member_*` / `invitation_*`）；前端隐藏后端会 403 的按钮，避免先亮后灰。

---

## 4. 📜 修撰履历与演进时间线 (Timeline)

- **2026-09-04 09:47** (`gjc & Cursor Agent`)：`[初版归档]` 沉淀 WeKnora 租户管理设计：Tenant 隔离边界、`tenant_members` 四级 RBAC 与 `creator_id` 归属守卫、开户/建空间策略、邀请闭环与最后 Owner 保护，以及与组织共享/平台管理员的正交边界。
