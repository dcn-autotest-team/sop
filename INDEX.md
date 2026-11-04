# SOP 知识资产总索引库 (Master Index)

> 本文件由 SOP 引擎自动同步维护。每次沉淀新项目时自动追加，需要查阅时自动检索。
> 状态：正常 | 收录总数：8 篇 | 最近更新：2026/11/4

---

## 快速检索导航

| 场景分类 | 目录路径 | 已收录资产数 | 涵盖核心技术栈 |
| :--- | :--- | :--- | :--- |
| **大模型与智能体** | [`library/ai-agent/`](./library/ai-agent/) | 4 | LangChain, RAG, Tauri, Prompt工程, 多模态抽取 |
| **小程序与跨端** | [`library/miniprogram/`](./library/miniprogram/) | 1 | 微信小程序, CloudBase, 移动端 |
| **前端与交互** | [`library/frontend/`](./library/frontend/) | 0 | 标准生产实践 |
| **后端与服务架构** | [`library/backend/`](./library/backend/) | 1 | 标准生产实践 |
| **脚本与自动化** | [`library/automation/`](./library/automation/) | 0 | 标准生产实践 |
| **综合与系统架构** | [`library/general/`](./library/general/) | 2 | 标准生产实践 |

---

## 已沉淀资产清单 (Assets Catalog)

### 大模型与智能体 (`library/ai-agent/`)
- **[AI-AGENT-001] [Super-agent 三层协作调度（Router-Worker-记忆层）](./library/ai-agent/super-agent-router-worker-scheduling-sop.md)** (1 次修撰) `[[多Agent协作, Super-agent, Router-Worker, 看门狗Watchdog, 记忆共享, 换人接管]]`
  - **核心技术**：任意 agent 框架（OpenClaw/Hermes/Claude Code 等）+ IM 群组 + 云端记忆库（如 OpenViking/SQLite）+ 通用巡检工具
  - **解决痛点**：多 agent 协作时任务派发靠人工转贴、agent 卡死无人管、换人/换窗口后上下文全丢、记忆散落各 agent 身上无法共享
- **[AI-AGENT-002] [RAG 知识库检索与文档问答管道标准实现](./library/ai-agent/rag-knowledge-base-pipeline.md)** (1 次修撰) `[RAG, 向量检索, 知识库问答, 文本切片]`
  - **核心技术**：Python, FastAPI, LangChain, Chroma/Milvus, OpenAI/Gemini Embeddings
  - **解决痛点**：项目标准化与避坑
- **[AI-AGENT-003] [跨端 AI 原生桌面悬浮助手与视觉感知架构标准实现 (Tauri + Win32 + Vision LLM)](./library/ai-agent/desktop-tauri-vision-copilot-sop.md)** (2 次修撰) `[桌面端, Tauri, 视觉感知, Win32, Prompt工程]`
  - **核心技术**：TypeScript, Tauri (Rust), React, Win32 API, UI Automation, Vision LLM, CJK Myers Diff, DPAPI
  - **解决痛点**：跨端桌面 AI 悬浮窗卡顿闪退、截屏旧帧污染与黑屏误判、视觉模型幻觉与方向识别混乱、跨进程文本安全投递、自动更新签名与私钥内存泄露等系统级工程难题。
- **[AI-AGENT-004] [工业级垂直领域多模态单证智能抽取与微服务调度架构 (FastAPI + Celery + Dynamic Few-Shot + Qwen/DeepSeek)](./library/ai-agent/cargo-document-multimodal-extraction-sop.md)** (1 次修撰) `[多模态, 智能抽取, Celery, FastAPI, 动态Few-Shot]`
  - **核心技术**：Python 3.11, FastAPI, Celery + Redis, PostgreSQL + SQLite, Qwen-VL / DeepSeek / SenseAudio LLM, Skill V3 Prompt Engineering, Dynamic Few-Shot In-Context Learning, Caddy 2 (TLS / Reverse Proxy), Docker Compose Cloud
  - **解决痛点**：垂直海运/国际货代单证格式非标杂乱、高并发下 LLM 空响应 `Expecting value: line 1 column 1` 异常中断、多租户 API 密钥计费与并发削峰、租户商业机密隔离与动态 Few-Shot 样本热生效、线上静态资源受境外 CDN 污染黑屏等系统级全栈工程难题。

### 小程序与跨端 (`library/miniprogram/`)
- **[MINIPROGRAM-001] [微信小程序 CloudBase + 云托管活动积分闭环](./library/miniprogram/wechat-miniprogram-cloudbase-cloud-hosting-sop.md)** (1 次修撰) `[微信小程序, 云托管, CloudBase, 数据库事务, 积分运营]`
  - **核心技术**：微信小程序, wx.cloud.callContainer, CloudBase 文档型数据库, CloudBase 云存储, Node.js, Docker, 微信云托管
  - **解决痛点**：线下活动积分/兑换/核销全链路业务割裂、跨端鉴权与幂等扣减易超卖、云托管真实流量与开发环境调试不一致等工程痛点。

### 前端与交互 (`library/frontend/`)
*暂无资产，等待沉淀...*

### 后端与服务架构 (`library/backend/`)
- **[BACKEND-001] [企业级多租户工作空间隔离与 RBAC 成员治理设计 (Go + PostgreSQL)](./library/backend/weknora-multi-tenant-rbac-sop.md)** (1 次修撰) `[多租户, RBAC, 数据隔离, 成员邀请]`
  - **核心技术**：Go, Gin, GORM, PostgreSQL, JWT(HMAC-SHA256), tenant_members, creator_id 归属守卫
  - **解决痛点**：SaaS/知识库产品从「单人即管理员」升级到多空间协作时，租户串数据、人人自动开个人空间、平台超管与空间 Owner 混权、最后一位 Owner 被删导致空间锁死、邀请与公开注册闸门不一致。

### 脚本与自动化 (`library/automation/`)
*暂无资产，等待沉淀...*

### 综合与系统架构 (`library/general/`)
- **[GENERAL-001] [OpenViking 跨机共享记忆库（Agent 自助接入）](./library/general/openviking-shared-memory-sop.md)** (2 次修撰) `[OpenViking, 长期记忆, 跨机接入, Tailscale, 密钥注入代理, 零密钥接入]`
  - **核心技术**：OpenViking 1.30.x, OpenClaw >= 2026.5.27, Tailscale Serve, 反向代理（Python http.server）, GitHub Pages
  - **解决痛点**：多台机器各跑 agent 时记忆分散各处，各自维护一套记忆库既重复又冲突；把远端库开放给别的机器又容易把 root key 发出去、或直接暴露到公网；交接材料靠人传文件、靠人写说明。
- **[GENERAL-002] [酒店 AI 多意图服务编排、工单闭环与全链路审计标准实现](./library/general/hotel-ai-service-orchestration-audit-sop.md)** (1 次修撰) `[酒店AI, 多意图编排, 工单状态机, 全链路审计]`
  - **核心技术**：Node.js 20+, 原生 HTTP/HTML/JavaScript, PostgreSQL JSONB, WebSocket, SenseAudio ASR/S2, 高德 Web 服务, 知识库 API, node:test
  - **解决痛点**：酒店住客的一段语音可能同时包含服务、设备、旅行和 FAQ 请求；若直接依赖单次模型输出，容易出现整句误转人工、工单越权流转、并发抢单、实时消息泄露、上游失败不可追踪及测试环境互相污染。

