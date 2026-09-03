# SOP: 工业级垂直领域多模态单证智能抽取与微服务调度架构 (FastAPI + Celery + Dynamic Few-Shot + Qwen/DeepSeek)

> **编号**: SOP-AI-003  
> **分类**: 大模型与智能体 (`ai-agent`)  
> **标签**: 多模态, 智能抽取, Celery, FastAPI, 动态Few-Shot  
> **核心栈**: Python 3.11, FastAPI, Celery + Redis, PostgreSQL + SQLite, Qwen-VL / DeepSeek / SenseAudio LLM, Skill V3 Prompt Engineering, Dynamic Few-Shot In-Context Learning, Caddy 2 (TLS / Reverse Proxy), Docker Compose Cloud  
> **解决痛点**: 垂直海运/国际货代单证格式非标杂乱、高并发下 LLM 空响应 `Expecting value: line 1 column 1` 异常中断、多租户 API 密钥计费与并发削峰、租户商业机密隔离与动态 Few-Shot 样本热生效、线上静态资源受境外 CDN 污染黑屏等系统级全栈工程难题。  
> **复用定位**: 适用于任何“多源非标单证 (邮件正文/PDF/图片/Excel) -> 多模态预解析 -> 动态 Few-Shot 样本注入 -> LLM 结构化抽取 -> 规范化归一 (Normalizer) -> 异步削峰队列 -> 租户计费与数据飞轮闭环”的企业级大模型应用。

---

## 1. 从 0 到 1 标准执行路径 (0-to-1 SOP)

### 阶段 1：多源非标单证预处理与视觉多模态管道
1. **多格式统一步伐**：
   - 文本类（`.eml`, `.msg`, `.txt`）：提取主题、发件人与正文纯文本，过滤多余控制字符。
   - 文档表格类（`.pdf`, `.docx`, `.xlsx`）：先做文本层提取（`pdfplumber` / `python-docx` / `openpyxl`），保留原始表格结构（转为 JSON 表格数组）。
   - 扫描件/图像类（`.jpg`, `.png`, 扫描 PDF）：接入视觉大模型（`qwen3.8-27b` / `Qwen-VL`），配置 `VisionBudget` 单任务图片数量上限（默认 5 张），并发下沉至线程池执行。
2. **多模态上下文预算管理**：
   - 提取文本按 `【文本内容】`、`【表格数据】`、`【OCR识别内容】` 格式化挂载为附件 Payload，避免直接向 Prompt 塞入未清洗的 Base64 图片产生巨额 Token 浪费。

### 阶段 2：动态 Few-Shot 少样本热注入与多租户安全隔离
1. **秒级热生效（Zero-Downtime Hot Reload）**：
   - 样本直接落库（PostgreSQL `few_shot_examples` 表），管理员在控制台增删改或启停后，对 API 与 Celery Worker 节点秒级热生效，无需重启服务或重新构建镜像。
2. **多租户数据隔离防泄露**：
   - 检索条件严格遵循：`WHERE is_active = true AND (source_tenant_id = :current_tenant_id OR source_tenant_id IS NULL)`。
   - 全局通用样本共享，企业定制样本私有，彻底杜绝企业商业单证跨租户泄露。
3. **Token 截断与优先级裁剪**：
   - 严格限制 `ORDER BY priority DESC, created_at DESC LIMIT 2`，单次注入额外 Token 控制在 200~500 tokens 以内。

### 阶段 3：双阶段容错解析与 JSON 智能边界裁剪
1. **空内容拦截与指数退避重试**：
   - 当大模型在瞬时高并发或网络抖动时返回 HTTP 200 但 `content` 为空串 `""`，严禁直接返回，必须判定为瞬时异常并自动触发指数退避重试（或自动切换备用 Fallback 模型）。
2. **最外层大括号 `{ ... }` 智能边界裁剪**：
   - 增强 `_clean_json_response()`：不仅匹配 ` ```json ... ``` ` Markdown 代码块，还自动定位最外层 `{` 与 `}` 进行子串提取，过滤模型自带的前后缀思考文字。
3. **二阶段修复 Prompt（Self-Correction）**：
   - 若初次 `json.loads()` 抛出 `JSONDecodeError`，自动提取错误信息，组装验证 Prompt 调用模型进行二阶段修补；若仍失败，提供基础空结构进行安全兜底，绝不向外层抛出裸异常。

### 阶段 4：Celery 异步削峰限流与租户并发配额管控
1. **Worker 并发与租户并发解耦对齐**：
   - 基础设施层 `CELERY_WORKER_CONCURRENCY`（Prefork 进程数）必须 $\ge$ 业务层 `DEFAULT_TENANT_CONCURRENCY`（单租户并发上限），防止压测时单租户打满 Worker 导致其它租户或心跳任务饥饿超时。
2. **租户并发原子锁（Redis Concurrency Leases）**：
   - 在任务分发阶段通过 Redis 对租户正在运行的任务数做原子计数，超限任务保持 `PENDING` 并在队列中排队，由 Celery Beat 定期巡检恢复。

### 阶段 5：工单纠错、金标自动化评测与数据飞轮闭环
1. **工单反馈一键沉淀**：
   - 租户在对账中心发现抽取偏差，提交反馈工单；
   - 管理员在后台审核工单时，核对原始邮件片段与期望 JSON，勾选 `create_few_shot=True` 与 `create_eval_case=True`，一键沉淀为该租户专属的 Few-Shot 样本及金标自动化回归评测用例。
2. **Prompt 批量回归评测**：
   - 迭代 Prompt 时，一键触发历史金标用例批量离线打分，保障核心字段抽取准确率不发生回退。

### 阶段 6：容器化一键双端部署与静态资源本地化
1. **静态资源去外部 CDN 依赖**：
   - 页面 3D 背景视频（`earth_bg.mp4`）及字体资产完整本地化托管在 `/static/media/` 目录下，彻底规避国内网络访问境外 CDN（如 AWS CloudFront）超时导致的黑屏现象。
2. **Docker Compose 多容器原子编排**：
   - API、Celery Worker、Celery Webhook Worker、Celery Beat、PostgreSQL、Redis、Caddy 2、自动备份 Sidecar 统一部署，提供 HealthCheck 与自动重启。

---

## 2. 踩坑与返工自查清单 (Pitfalls & Checklist)

- [x] **踩坑 1：大模型高并发下返回空内容导致 `Expecting value: line 1 column 1 (char 0)`**  
  *原因*：上游大模型在高并发负载下返回 HTTP 200 但 `content` 字段为空字符串 `""`，代码未做非空校验直接 `json.loads("")` 抛出异常崩溃。  
  *解法*：`call_llm` 对 HTTP 200 返回做 `if not raw_content.strip()` 拦截并触发自动重试；`_clean_json_response` 增加最外层 `{ ... }` 智能裁剪与空结构降级兜底。
- [x] **踩坑 2：高并发压测队列超时与死锁 (Worker Concurrency < Tenant Concurrency)**  
  *原因*：Celery Worker Concurrency 默认为 2，而租户并发上限设置为 20，导致 100 封并发压测时 Worker 处理不过来，前端轮询 120s 超时报错。  
  *解法*：统一调大 `CELERY_WORKER_CONCURRENCY=20` 与 `DEFAULT_TENANT_CONCURRENCY=20`，前端压测轮询设置动态超时（`Math.max(300000, count * 6000)`）与分页增量抓取。
- [x] **踩坑 3：API Key 复制功能仅复制到前缀前 11 位**  
  *原因*：老版本仅存储单向不可逆哈希（`key_hash`），`raw_key` 字段为空导致回退至 `key_prefix`。  
  *解法*：持久化完整 `raw_key`（55 字符），前端 UI 对历史未存明文的 Key 展示黄色警示 Tooltip，对新生成的 Key 提供一键完整复制。
- [x] **踩坑 4：SQLite 与 PostgreSQL 差异化 DDL 迁移兼容**  
  *原因*：SQLite 不支持 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，而 PostgreSQL 不支持 SQLite 的特定 PRAGMA 语法。  
  *解法*：在 `init_db()` 中根据 `engine.name` 严格分支处理，PostgreSQL 迁移包裹独立 Savepoint 保护事务。
- [x] **踩坑 5：线上页面背景 3D 地球黑屏消失**  
  *原因*：动态背景视频直接引用 AWS CloudFront 境外 CDN 链接，在国内直连服务器 IP 时被网络拦截或握手超时。  
  *解法*：将 `earth_bg.mp4`（13.35 MB）下载并内置到项目 `app/static/media/` 目录下本地托管，彻底根除对外部 CDN 的依赖。
- [x] **踩坑 6：Few-Shot 样本跨租户泄露商业机密**  
  *原因*：单证内容包含客户真实价格与货运私密数据，若全局注入会导致其它企业看到竞品信息。  
  *解法*：数据库增加 `source_tenant_id` 外键约束，样本检索强制匹配 `source_tenant_id == current_tenant OR NULL`。

---

## 3. 面向 AI 的系统铁律 (Never do / Always do)

### 3.1 绝对禁止 (Never do)
1. **Never**：严禁在未做 `content` 非空校验的情况下直接将 LLM 返回文本传给 `json.loads()`。
2. **Never**：严禁在 `FewShotService` 查询中遗漏租户隔离条件 `(source_tenant_id = :tenant_id OR source_tenant_id IS NULL)`。
3. **Never**：严禁在前端页面中硬编码外部不稳定 CDN 作为核心视觉/逻辑资源的唯一来源。
4. **Never**：严禁将 `CELERY_WORKER_CONCURRENCY` 设置为小于业务层 `DEFAULT_TENANT_CONCURRENCY` 的值。
5. **Never**：严禁将原始 API Key 明文或管理员密码提交到代码库或输出到公开日志中。

### 3.2 必须遵循 (Always do)
1. **Always**：大模型调用必须配置 `temperature=0.0`、强超时控制（Timeout）与备用模型（Fallback Model）兜底。
2. **Always**：Few-Shot Prompt 注入必须严格限制数量（`LIMIT 2`）并按优先级倒序，避免 Prompt 无限膨胀。
3. **Always**：所有异步抽取任务必须支持租户级别限流、幂等重试与财务预扣/实扣原子事务。
4. **Always**：数据库 DDL 动态迁移必须区分 SQLite 与 PostgreSQL 方言，并对 PostgreSQL 执行 Savepoint 事务隔离。
5. **Always**：发布上线前必须运行全套单元测试与回归测试（`pytest` 覆盖率 > 90%）。

---

## 4. 架构全景拓扑 (Architecture Topology)

```text
               ┌────────────────────────────────────────────────────────┐
               │        用户 / ERP 客户端 / Webhook 发起抽取请求          │
               └──────────────────────────┬─────────────────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │    Caddy 2 反向代理 (TLS 终结 / 静态资源)  │
                      └───────────────────┬───────────────────┘
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │  FastAPI 微服务 (鉴权 / 扣费 / 任务分发) │
                      └───────┬───────────────────────┬───────┘
                              │                       │
           (同步秒级通道)       │                       │  (异步削峰通道)
                              ▼                       ▼
            ┌───────────────────────────┐   ┌───────────────────────────┐
            │ SkillRunner 实时抽取管道    │   │ Celery Redis 削峰限流队列  │
            └─────────────┬─────────────┘   └─────────────┬─────────────┘
                          │                               │
                          ▼                               ▼
            ┌───────────────────────────────────────────────────────────┐
            │                    核心执行与数据流转层                     │
            │  1. VisionService 多模态视觉解析 (Qwen-VL)                  │
            │  2. FewShotService 动态样本检索 (租户隔离 + 热生效)           │
            │  3. LLM 推理引擎 (SenseAudio / DeepSeek + 空响应自动重试)    │
            │  4. Normalizer & Validator 字段规范归一 (57 核心字段)       │
            └─────────────────────────────┬─────────────────────────────┘
                                          │
                                          ▼
            ┌───────────────────────────────────────────────────────────┐
            │                    数据持久化与反馈闭环                     │
            │  - PostgreSQL 16 (任务流水 / 账单流水 / 租户秘钥 / 样本库)   │
            │  - 客户工单纠错反馈 ──> 一键沉淀为 Few-Shot 样本 & 金标测试用例 │
            └───────────────────────────────────────────────────────────┘
```

---

## 5. 📜 修撰履历与演进时间线 (Timeline)

- **2026-09-01 12:40** (`yanwh & Antigravity`)：`[初版归档]` 沉淀工业级货代单证多模态抽取架构、Celery 削峰与租户并发对齐、动态 Few-Shot 样本隔离热注入、LLM 空响应防御与静态资产本地化最佳实践。
