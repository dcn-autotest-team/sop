# SOP 知识资产总索引库 (Master Index)

> 本文件由 SOP 引擎自动同步维护。每次沉淀新项目时自动追加，需要查阅时自动检索。
> 状态：正常 | 收录总数：4 篇 | 最近更新：2026/9/3

---

## 快速检索导航

| 场景分类 | 目录路径 | 已收录资产数 | 涵盖核心技术栈 |
| :--- | :--- | :--- | :--- |
| **大模型与智能体** | [`library/ai-agent/`](./library/ai-agent/) | 3 | LangChain, RAG, Tauri, Prompt工程, 多模态抽取 |
| **小程序与跨端** | [`library/miniprogram/`](./library/miniprogram/) | 1 | 微信小程序, CloudBase, 移动端 |
| **前端与交互** | [`library/frontend/`](./library/frontend/) | 0 | 标准生产实践 |
| **后端与服务架构** | [`library/backend/`](./library/backend/) | 0 | 标准生产实践 |
| **脚本与自动化** | [`library/automation/`](./library/automation/) | 0 | 标准生产实践 |
| **综合与系统架构** | [`library/general/`](./library/general/) | 0 | 标准生产实践 |

---

## 已沉淀资产清单 (Assets Catalog)

### 大模型与智能体 (`library/ai-agent/`)
- **[AI-AGENT-001] [RAG 知识库检索与文档问答管道标准实现](./library/ai-agent/rag-knowledge-base-pipeline.md)** (1 次修撰) `[RAG, 向量检索, 知识库问答, 文本切片]`
  - **核心技术**：Python, FastAPI, LangChain, Chroma/Milvus, OpenAI/Gemini Embeddings
  - **解决痛点**：项目标准化与避坑
- **[AI-AGENT-002] [工业级垂直领域多模态单证智能抽取与微服务调度架构 (FastAPI + Celery + Dynamic Few-Shot + Qwen/DeepSeek)](./library/ai-agent/cargo-document-multimodal-extraction-sop.md)** (1 次修撰) `[多模态, 智能抽取, Celery, FastAPI, 动态Few-Shot]`
  - **核心技术**：Python 3.11, FastAPI, Celery + Redis, PostgreSQL + SQLite, Qwen-VL / DeepSeek / SenseAudio LLM, Skill V3 Prompt Engineering, Dynamic Few-Shot In-Context Learning, Caddy 2 (TLS / Reverse Proxy), Docker Compose Cloud
  - **解决痛点**：垂直海运/国际货代单证格式非标杂乱、高并发下 LLM 空响应 `Expecting value: line 1 column 1` 异常中断、多租户 API 密钥计费与并发削峰、租户商业机密隔离与动态 Few-Shot 样本热生效、线上静态资源受境外 CDN 污染黑屏等系统级全栈工程难题。
- **[AI-AGENT-003] [跨端 AI 原生桌面悬浮助手与视觉感知架构标准实现 (Tauri + Win32 + Vision LLM)](./library/ai-agent/desktop-tauri-vision-copilot-sop.md)** (2 次修撰) `[桌面端, Tauri, 视觉感知, Win32, Prompt工程]`
  - **核心技术**：TypeScript, Tauri (Rust), React, Win32 API, UI Automation, Vision LLM, CJK Myers Diff, DPAPI
  - **解决痛点**：跨端桌面 AI 悬浮窗卡顿闪退、截屏旧帧污染与黑屏误判、视觉模型幻觉与方向识别混乱、跨进程文本安全投递、自动更新签名与私钥内存泄露等系统级工程难题。

### 小程序与跨端 (`library/miniprogram/`)
- **[MINIPROGRAM-001] [微信小程序 CloudBase + 云托管活动积分闭环](./library/miniprogram/wechat-miniprogram-cloudbase-cloud-hosting-sop.md)** (1 次修撰) `[微信小程序, 云托管, CloudBase, 数据库事务, 积分运营]`
  - **核心技术**：微信小程序, wx.cloud.callContainer, CloudBase 文档型数据库, CloudBase 云存储, Node.js, Docker, 微信云托管
  - **解决痛点**：线下活动积分/兑换/核销全链路业务割裂、跨端鉴权与幂等扣减易超卖、云托管真实流量与开发环境调试不一致等工程痛点。

### 前端与交互 (`library/frontend/`)
*暂无资产，等待沉淀...*

### 后端与服务架构 (`library/backend/`)
*暂无资产，等待沉淀...*

### 脚本与自动化 (`library/automation/`)
*暂无资产，等待沉淀...*

### 综合与系统架构 (`library/general/`)
*暂无资产，等待沉淀...*

