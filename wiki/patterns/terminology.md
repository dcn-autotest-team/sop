# 模式：行业与专业术语规范 (Terminology Pattern)

- **ID**: `pattern-terminology-001`
- **更新时间**: 2026-09-02
- **描述**: 防止模型在改写过程中随意翻译、拆解或错改专业术语。

## 规则清单
1. **指标与硬件术语**：
   - `TTFT` (Time to First Token)、`TPOT` (Time per Output Token)、`TPS` (Tokens per Second) 严格保持全大写英文缩写，不得臆测翻译为“首字耗时”等非标口语。
   - `NPU`、`GPU`、`vLLM`、`昇腾 (Ascend)` 等专有名词保留官方标准大小写。
2. **动词习惯**：
   - 技术与业务协作中，推荐使用“对齐目标/进度”，避免使用模糊的“对接一下”。
   - 代码评审中，推荐使用“合并/回滚/重构”，避免使用“弄一下分支”。
