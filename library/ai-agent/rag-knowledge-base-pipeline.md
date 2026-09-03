# SOP: RAG 知识库检索与文档问答管道标准实现

> **编号**: SOP-AI-001  
> **分类**: 大模型与智能体 (`ai-agent`)  
> **标签**: RAG, 向量检索, 知识库问答, 文本切片  
> **核心栈**: Python, FastAPI, LangChain, Chroma/Milvus, OpenAI/Gemini Embeddings  
> **复用定位**: 任何需要“本地文档上传 -> 向量化 -> 相似度检索 -> 大模型增强生成”的业务场景

---

## 1. 从 0 到 1 标准执行路径 (0-to-1 SOP)
1. **阶段 1：文档解析与清洗**
   - 提取纯文本，过滤无效字符、乱码与过长连续换行。
   - 规则：Markdown/PDF 保留标题层级元数据（Metadata: header_1, header_2）。
2. **阶段 2：语义分块 (Chunking)**
   - ChunkSize 控制在 500~800 tokens，Overlap 保持 10%~15%（防语义在切点被截断）。
   - 严禁按纯物理字符硬切。
3. **阶段 3：向量入库与混合检索 (Hybrid Retrieval)**
   - 必须使用“语义向量相似度 (Dense) + BM25 关键词检索 (Sparse)”双路召回。
   - 接入轻量 Rerank（重排序模型），取 Top-3 返回给 Prompt。
4. **阶段 4：Prompt 组装与防幻觉注入**
   - 明确限制模型：“仅根据以下检索到的上下文回答，若上下文未提及，请明确回复‘根据现有资料无法获知’”。

---

## 2. 踩坑与返工自查清单 (Pitfalls & Checklist)
- [x] **踩坑 1：召回内容语义不连贯**  
  *原因*：Chunk 切分太小，导致上下文主谓缺失。  
  *解法*：使用 ParentDocumentRetriever 模式（切小块做检索索引，召回对应的大块整段）。
- [x] **踩坑 2：专有名词或英文缩写搜不到**  
  *原因*：Embedding 模型对生僻行业术语不敏感。  
  *解法*：必须开启 BM25 关键词精确匹配作为兜底。

---

## 3. 面向 AI 的系统铁律 (Agent Instructions)
1. **Never**：严禁在未配置降级策略（Fallback）的情况下直接做向量数据库全量查询。
2. **Always**：所有向量化操作必须以 Batch（批处理，每次 50~100 条）方式执行，禁止单条同步循环请求。
3. **Always**：接口输出必须包含引用来源（Citation/Source Document ID 与行号）。

---

## 4. 📜 修撰履历与演进时间线 (Timeline)

- **2026-08-31 22:17** (`yanwh & Antigravity`)：`[初版归档]` 沉淀 RAG 知识库语义分块、双路召回（BM25 + Dense Vector）与防幻觉规约。

