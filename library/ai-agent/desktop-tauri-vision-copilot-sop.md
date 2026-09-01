# SOP: 跨端 AI 原生桌面悬浮助手与视觉感知架构标准实现 (Tauri + Win32 + Vision LLM)

> **编号**: SOP-AI-002  
> **分类**: AI 与 Agent 开发 (`ai-agent`)  
> **核心栈**: TypeScript, Tauri (Rust), React, Win32 API, UI Automation, Vision LLM, CJK Myers Diff  
> **复用定位**: 适用于任何需要“桌面置顶悬浮窗 -> 屏幕高频截图/焦点感知 -> 视觉多模态模型理解 -> 跨进程文本/键鼠模拟投递”的系统级 AI Copilot 场景。

---

## 1. 从 0 到 1 标准执行路径 (0-to-1 SOP)

1. **阶段 1：Tauri 原生无边框透明悬浮窗与穿透控制**
   - 配置 `tauri.conf.json`：`alwaysOnTop: true`, `decorations: false`, `transparent: true`, `skipTaskbar: true`。
   - 必须实现点击穿透（Click-through）与焦点获取的动态切换（Rust 层通过 `SetWindowLongPtr` 动态设置 `WS_EX_TRANSPARENT` 与 `WS_EX_LAYERED`）。
2. **阶段 2：屏幕捕获与低延迟 IPC 管道**
   - 屏幕截图逻辑下沉至 Rust 后端（使用 Windows Graphics Capture API 或 GDI+），严禁在前端用 Web API 截全屏。
   - 截屏大图通过**共享内存或本地临时文件 URI/二进制流**传递给前端，禁止将 Base64 字符串直接丢进 Tauri IPC 事件管道（防止序列化性能骤降与丢包）。
3. **阶段 3：视觉多模态 Prompt 构造与 ROI 裁剪**
   - 截屏前先通过 UI Automation 获取当前焦点窗口/光标周围的 Bounding Box，做局部 ROI 区域裁剪。
   - 针对 Vision LLM 构造双阶段 Prompt：先由模型输出结构化 JSON 定位目标与意图，再二次生成具体执行方案，降低幻觉率。
4. **阶段 4：跨进程投递与 CJK 输入校验**
   - 向第三方窗口投递文本时，禁用物理按键模拟（易丢失中文拼音输入法状态）。
   - 优先采用剪贴板接力（`SetClipboardData` + `SendInput Ctrl+V`）或 UI Automation ValuePattern 注入，投递后触发 Myers Diff 校验目标窗口文本状态。

---

## 2. 踩坑与返工自查清单 (Pitfalls & Checklist)

- [x] **踩坑 1：抗截屏旧帧与脏帧**  
  *原因*：Windows DWM 合成器缓存未刷新时，立刻截屏会捕获到悬浮窗关闭前的残影。  
  *解法*：隐藏悬浮窗后，调用 `DwmFlush()` 或微延迟 16ms（一帧时间）后再触发截屏。
- [x] **踩坑 2：焦点漂移导致误捕获后台窗口**  
  *原因*：用户点击悬浮窗瞬间，原激活窗口失去焦点（Active Window 变成了悬浮窗自身）。  
  *解法*：在悬浮窗显示前常驻记录上一次的前台窗口句柄 `GetForegroundWindow()`，所有感知与投递均以此句柄为基准。
- [x] **踩坑 3：大尺寸截屏导致 Tauri IPC 卡顿/内存暴涨**  
  *原因*：前端渲染 4K 截屏 Base64 触发多次内存拷贝与垃圾回收。  
  *解法*：Rust 截屏后降采样至适合 LLM 的分辨率（长边 ≤ 1568px），并转换为 WebP/JPEG 格式后返回。

---

## 3. 面向 AI 的系统铁律 (Agent Instructions)

1. **Never**：严禁在前端渲染主线程直接解码或处理高频高分辨率原始 Bitmap 图像。
2. **Never**：严禁在未记录原窗口句柄的前提下直接模拟全局键盘鼠标事件。
3. **Always**：所有 Rust 与前端的自定义 IPC 事件必须使用强类型 `ts-rs` 或严格 TypeScript 契约对齐。
4. **Always**：涉及剪贴板操作时，必须在读取和写入前保存用户原剪贴板内容并在操作完成后自动还原。
