---
name: sop-keeper
description: >-
  用于自动访谈其他 AI 并萃取项目经验、归档沉淀为标准 SOP/AGENTS.md 资产，以及在新项目启动时快速检索匹配历史最佳实践。
  当用户想要“复盘沉淀当前项目”、“把其他 AI/对话的成果变成 SOP”、“查找/调用以前沉淀过的最佳实现”时触发。
---

# SOP Keeper (全自动项目经验萃取与复用引擎)

本技能的目标是：**用户只需甩给 AI 一句话（甚至只是一段对话记录/代码），所有访谈解析、场景识别、防踩坑规约提炼、分类归档、目录索引更新全部自动完成；新项目来临时一键检索注入。**

---

## 核心工作流 1：经验沉淀模式 (Ingest & Extract)

当用户说：“**帮我把刚刚这个项目沉淀成 SOP**”、“**这是另一个 AI 做的项目，你帮我复盘沉淀**” 或直接粘贴了一大段对话记录时：

### 第 1 步：场景判定 (无需用户操心)
自动分析代码/对话，归入以下 5 大类别之一：
1. `frontend/` (React, Next.js, Vue, UI 组件库, 小程序等)
2. `backend/` (Node/Nest, Python/FastAPI, Go, 数据库设计等)
3. `ai-agent/` (RAG, Prompt 管道, Agent 工作流, 向量数据库等)
4. `automation/` (爬虫, 脚本批处理, 自动化测试, CI/CD 等)
5. `general/` (全栈 MVP, 微服务, 工具链架构等)

### 第 2 步：自动“自问自答”式深度访谈 (Deep Extraction)
**禁止向用户提一堆技术问题增加负担**。SOP-Keeper 必须在内部以资深架构师的视角审视输入信息，自动提炼出以下四项核心内容：
1. **0-to-1 极简破局步骤 (4 步以内)**：初始化命令、核心骨架结构、验证标准。
2. **避坑与返工自查清单**：本次踩过的坑、为什么踩、如何避免。
3. **黄金代码范式 (Golden Code Snippet)**：最具通用价值的一两段核心实现。
4. **面向后续 AI 的“紧箍咒”**：3 条绝对禁止 (Never do) + 3 条必须遵守 (Always do)。

### 第 3 步：自动落盘、维护索引并一键推送到 GitHub (无需用户任何操作)
1. 在 `d:/agent/agv/sop/library/<category>/<slug-name>.md` 创建标准的 SOP 文档。
2. 自动更新 `d:/agent/agv/sop/INDEX.md` 总索引导航与 `sops.json`。
3. **全自动 Git 推送**：
   - 自动在当前工作区执行：
     ```bash
     git add .
     git commit -m "docs(sop): auto archive [分类] [项目名称] SOP assets"
     git push origin main
     ```
4. **给用户的反馈力求极简（2句话搞定）**：
   - 告诉用户：已自动萃取并推送到 GitHub 仓库 (https://github.com/dcn-autotest-team/sop)。
   - 在线静态知识库已自动同步：https://dcn-autotest-team.github.io/sop/
   - 列出提炼出的 3 条最核心的避坑规约。

---

## 核心工作流 2：新项目一键检索与经验注入 (Retrieve & Apply)

当用户说：“**查阅我的 SOP 仓库，准备启动新项目 xxx**”：

1. **查阅总索引**：直接读取本地或云端的 `INDEX.md`。
2. **匹配并加载**：找到最匹配的 1~2 篇历史 SOP。
3. **直接生成项目基准规则**：
   - 自动在当前新项目根目录创建或更新 `AGENTS.md`。
   - 注入 0-1 步骤与避坑 Never/Always 约束，实现零摩擦开工。

