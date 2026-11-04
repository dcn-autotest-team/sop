# SOP: OpenViking 跨机共享记忆库（Agent 自助接入）

> **编号**: SOP-GENERAL-002
> **分类**: 综合与系统架构 (`general`)
> **标签**: OpenViking, 长期记忆, 跨机接入, Tailscale, 密钥注入代理
> **核心栈**: OpenViking 1.30.x, OpenClaw >= 2026.5.27, Tailscale Serve, 反向代理（Python http.server）
> **解决痛点**: 多台机器各跑 agent 时记忆分散各处，各自维护一套记忆库既重复又冲突；把远端库开放给别的机器又容易把 root key 发出去、或直接暴露到公网。
> **复用定位**: 适用于"一个记忆库 + 多台机器 agent 共用"的任意场景：主机跑实例，其他机器只装插件指过来，凭据由主机注入，接入方零密钥。

---

## 1. 从 0 到 1 标准执行路径 (0-to-1 SOP)

### 阶段 1：先把入口做出来，但不要外发凭据

1. OpenViking 默认只监听 `127.0.0.1:1933`，外部机器连不进去。这是正确默认，不要改成 `0.0.0.0`。
2. 用 `tailscale serve --https=<port>` 把本地端口映射到 tailnet 内可达的 HTTPS 地址。**不要用 Funnel**；Funnel 会推到公网。
3. 关键一步：不要在接入端配置 API Key。在主机上加一层注入代理，读本机凭据文件后给每个上游请求补上鉴权头。接入端只凭 tailnet 身份访问，拿不到、也不需要 key。
4. 代理必须支持流式转发。MCP streamable-http 的响应是 `text/event-stream`，整包缓冲会让握手看起来卡住。

**验收证据**：无任何凭据时 `/health` 返回 `healthy:true` 且带正确 `user_id`；`/api/v1/fs/ls` 返回 200；`/mcp` 握手能返回 `serverInfo`；以上全部经 tailnet 域名验证，不是本机回环。

### 阶段 2：让插件识别"无密钥"模式

1. OpenClaw 的 OpenViking 插件配置里 `apiKey` 留空字符串不会报错，它只在 key 非空时才加 `X-API-Key` 头，正好配合注入代理。
2. `peer_role` 必须是 `none`，这样记忆落在 `viking://user/<uid>/memories` 这层用户共享树。设成 `assistant` 或 `sender` 会落到 `peers/<id>/` 子树，两台机器当场分家。
3. 装完插件会把 `contextEngine` 槽从 `legacy` 切到 `openviking`，这是预期行为，不要回滚。
4. 接入端拿到的应是离线插件包：目标机器常见访问 npm 官方源 `ECONNRESET`，联网安装会失败。

**验收证据**：`openclaw config get plugins.slots.contextEngine` 返回 `openviking`；`openviking status --json` 显示已连接；用空 key 的客户端调用远端 `list`/`find` 均有返回。

### 阶段 3：把材料放到 tailnet 上，而不是靠人传文件

1. 用第二个 `tailscale serve --https=<port>` 把放材料的目录映射出去。注意 Windows 下 `serve` 传目录路径需要管理员权限，改为先用本机 HTTP 服务起目录、再 serve 那个端口。
2. 目录里至少放：接入说明页、离线插件包、可选的自检脚本。
3. 接入端用一条 `Invoke-WebRequest` 就能把插件包拉下来，不再依赖人工拷贝。

**验收证据**：从 tailnet 域名能下载说明页与插件包，字节数与源文件一致。

### 阶段 4：写进 SOP 站，实现"一对一链接对接"

1. 把整篇接入流程沉淀成 SOP，接入方的用户只需发站点链接给你，不需要再打一段说明。
2. 文中必须写出**判定标准**与**禁止项**，否则接入方会把"能连"当成"已共享"。
3. 禁止项至少覆盖：索要 key、开 Funnel、建新 account/user、两端自行导出导入同步、改 `peer_role`。

**验收证据**：接入方按文档独立完成接入；主机端查到接入方写入的记忆；两端看到同一份。

---

## 2. 踩坑与返工自查清单 (Pitfalls & Checklist)

| 陷阱/现象 | 根本原因 | 标准解决姿势 |
| --- | --- | --- |
| 接入端报 401 | 忘了加注入代理，直接 serve 了 1933 | 先确认代理 `/health` 能返回 `user_id`，再 serve 代理端口 |
| 代理返回 `400 Invalid HTTP request received` | 用 `http.client` 拼上游请求时漏了 `Host` 头 | `putrequest(skip_host=True)` 后必须显式补 `Host` |
| MCP 握手卡住不返回 | 代理整包缓冲了 `text/event-stream` | 按块转发并在流式响应上立即 `flush` |
| Windows 下 `serve` 目录报 401 Unauthorized | `serve` 传本地目录需要管理员权限 | 用本机 HTTP 服务托管目录，再 serve 那个端口 |
| 插件装完仍然连不上 | 只写了 `baseUrl`，漏了 `mode=remote` | 两者一起写，`peer_role` 同时确认是 `none` |
| 空 key 被拒 | 误以为 `apiKey` 必填 | 留空字符串即可，客户端只判断非空才加头 |
| 离线包解压后插件加载失败 | 只装了 `dist`，缺 `node_modules` 依赖 | 包内必须带上 `fflate` 与 `@sinclair/typebox` |
| 两台机器记忆互不可见 | `peer_role` 被改成 `assistant`/`sender` | 改回 `none`；已分出去的记忆不会自动合并 |
| 接入端把 root key 要走了 | 文档没写清 root/ user key 的边界 | 文档明确"不需要 key"，从源头掐断 |
| 主机原有服务被影响 | 复用同一个端口覆盖了旧代理 | 每次 serve 用独立端口，先看 `serve status` |

### 提交前 Checklist

- [ ] `serve status` 里新增端口只指向代理，且未出现在 `AllowFunnel` 中。
- [ ] 代理日志不含凭据；健康检查能返回非 root 的 user 身份。
- [ ] 离线包解压后 `dist/index.js`、`node_modules/fflate`、`node_modules/@sinclair/typebox` 三者在位。
- [ ] 文档写明判定标准，且把"能连"与"已共享"区分开。
- [ ] 端到端验证：接入端写入后，主机端能读到同一条。

---

## 3. 面向 AI 的系统铁律 (Never do / Always do)

**Never do**
- 不要把 `root_api_key` 发给任何接入端。它能建账号、管账号，等于整个实例的管理权。
- 不要对服务端口开 Funnel。一旦开，记忆库就上了公网。
- 不要为了"方便"把服务 `host` 改成 `0.0.0.0`，或把 `auth_mode` 改成 `dev`。
- 不要在两端跑 `ov export`/`import`、自写定时同步、或建第二个 account。共用实例本身就是同步。
- 不要把 `peer_role` 设成 `assistant`/`sender` 后又期望记忆合并。
- 不要在聊天里、命令行参数里、日志里出现明文 key。

**Always do**
- 先确认 `serve status` 里目标端口不在 `AllowFunnel` 列表，再对外提供。
- 凭据只从主机本地文件读取，由代理注入；接入端零密钥。
- 每次改动后跑一次端到端：接入端写入 → 主机端读取。
- 文档里同时给判定标准和禁止项，避免"看起来通了"被当成完成。

---

## 4. 修撰履历与演进时间线 (Timeline)

- **2026-11-04 21:00** (`严文会 & LobsterAI`): `[初版归档]` 建立跨机共享记忆 SOP：tailnet serve 双端口（服务入口 + 材料分发）、密钥注入代理、空 key 插件配置、离线插件包、接入文档三段式判定与禁止项。
