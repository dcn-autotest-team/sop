# SOP: 跨端 AI 原生桌面悬浮助手与视觉感知架构标准实现 (Tauri + Win32 + Vision LLM)

> **编号**: SOP-AI-002  
> **分类**: 大模型与智能体 (`ai-agent`)  
> **标签**: 桌面端, Tauri, 视觉感知, Win32, Prompt工程  
> **核心栈**: TypeScript, Tauri (Rust), React, Win32 API, UI Automation, Vision LLM, CJK Myers Diff, DPAPI  
> **解决痛点**: 跨端桌面 AI 悬浮窗卡顿闪退、截屏旧帧污染与黑屏误判、视觉模型幻觉与方向识别混乱、跨进程文本安全投递、自动更新签名与私钥内存泄露等系统级工程难题。  
> **复用定位**: 适用于任何需要“桌面置顶悬浮窗 -> 屏幕高频截图/焦点感知 -> 视觉多模态模型理解 -> 跨进程文本/键鼠模拟投递 -> 自动化协同”的系统级 AI Copilot 场景。

---

## 1. 从 0 到 1 标准执行路径 (0-to-1 SOP)

1. **阶段 1：Tauri 原生无边框透明悬浮窗与几何排他锁**
   - **窗口属性配置**：`tauri.conf.json` 设置 `alwaysOnTop: true`, `decorations: false`, `transparent: true`, `skipTaskbar: true`。
   - **防自身截屏**：悬浮窗启动阶段必须调用 Win32 API `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`（0x11），从系统合成器层面杜绝自我捕获造成的画中画死循环。
   - **几何排他锁 (Geometry Lock)**：多异步源（划词胶囊、主面板展开、热键切换）并发调整窗口时，必须采用原子互斥锁。严格遵循“**先算最终坐标 -> 原子更新尺寸与位置 -> 最后调用 show/set_focus**”，严禁先显示再位移，根除窗口闪烁与 WebView2 崩溃。
   - **内存防抖**：悬浮窗隐藏时调用 `hide_main_window` 重置焦点与临时状态，保留 DOM 实例，切忌销毁窗口，避免频繁唤起的冷启动白屏（1.5s+）与 GPU 进程重建。

2. **阶段 2：屏幕捕获与低延迟 Rust 常驻管道**
   - **热键瞬间锁定 HWND**：热键按下瞬间必须同步获取前台 `target_hwnd = GetForegroundWindow()` 并透传给后续异步流程。严禁在异步探测（如 200ms）后才获取焦点，防止焦点漂移。
   - **抗旧帧截屏**：优先使用 `BitBlt` 抓取屏幕。只要获取到非全黑画面，**严禁回退调用 `PrintWindow(..., PW_RENDERFULLCONTENT)`**，避免 DirectComposition 硬件加速应用（飞书、微信、VSCode 等）被覆盖为陈旧脏帧。
   - **全图跳步全黑采样**：针对 Windows 窗口最大化 `(-8, -8)` 坐标与深色自绘标题栏，严禁仅检查前几行像素，必须执行全图跨步采样（如均匀 512 点采样），准确判定是否需要 DWM 刷新。
   - **Rust 原生内存常驻**：全屏截图及高分辨率 Bitmap 严禁通过 WebView2 IPC（Tauri emit / postMessage）全量传输。截屏常驻 Rust 全局 Mutex，前端仅传递信号，请求模型时由 Rust 侧直接组装。

3. **阶段 3：视觉多模态 Prompt 构造与零幻觉防御**
   - **气泡方向事实注入**：在 Prompt 中明确注入聊天界面事实：“头像/气泡在左侧为对方提问，在右侧为自己回复；若最底部是自己发的消息，说明已回复完毕，has_new_question 必须为 false”。
   - **无对话零幻觉兜底**：明确系统约束：“若非即时通讯窗口或无有效对话气泡，严格返回空结构，绝对禁止编造虚构历史”。
   - **端到端纯 JSON 输出与容错**：模型必须输出纯 JSON 对象，解析层内置 `extractJsonFromText` 容错函数（自动去除 Markdown 代码块包裹与冗余文本）。
   - **内置 Mock 流式兜底**：未配置 API Key 时自动回退至内置 Mock 流，保证开箱即用、无配置可演示及自动化测试 100% 顺畅。

4. **阶段 4：跨进程投递与 CJK 字符级 Myers Diff 校验**
   - **UIA 强超时与降级**：UI Automation 探测异常窗口时设置 150~200ms 强超时，超时后自动降级至模拟按键（`Ctrl+C`）+ 剪贴板比对。
   - **剪贴板防回环与 PII 脱敏**：监听剪贴板时记录自身最近写入的哈希值，忽略自身写事件；前置执行手机号、身份证校验和、UUID、密码管理器黑名单过滤。
   - **全自动双安全门**：全自动发送必须满足：“`has_new_question === true` + 草稿非空 + `latest_message_from === 'other'` + UIA 聚焦底部输入框 + 粘贴后 UIA 校验输入框文本一致”。投递成功后进入 15 秒全局冷却。
   - **CJK-Aware Myers Diff**：中文润色/代码改写基于标点符号和 CJK 字符边界分词，并内嵌 LaTeX 与代码块原样保护，比对后校验括号与公式完整性。

---

## 2. 踩坑与返工自查清单 (Pitfalls & Checklist)

- [x] **踩坑 1：抗 DirectComposition 缓存旧帧污染**  
  *原因*：Chromium/Electron 采用硬件加速渲染，`PrintWindow(PW_RENDERFULLCONTENT)` 会返回合成器缓存的旧帧。  
  *解法*：只要 `BitBlt` 抓取到非全黑画面，绝对不回退 `PrintWindow`；隐藏悬浮窗后微延迟一帧（16ms）触发截屏。
- [x] **踩坑 2：快捷键瞬间焦点漂移**  
  *原因*：用户按下快捷键后，前端/系统焦点切换导致后续异步获取的 `GetForegroundWindow()` 变成了悬浮窗自身。  
  *解法*：热键注册回调最开始同步捕获 `target_hwnd` 并全程透传。
- [x] **踩坑 3：全黑检测误判（最大化窗口与深色标题栏）**  
  *原因*：Windows 最大化窗口坐标为 `(-8, -8)`，前几行（如 `take(4096)`）仅占 1.6 行深色标题栏，误判全黑。  
  *解法*：全图均匀 512 采样点跳步判定。
- [x] **踩坑 4：悬浮窗自身画中画死循环**  
  *原因*：置顶悬浮窗截屏时把自身渲染内容也截取进去。  
  *解法*：启动时设置 `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`。
- [x] **踩坑 5：大体积图片 IPC 缓冲区超限静默丢包**  
  *原因*：4K 截图 Base64 字符串（数 MB）通过 Tauri IPC emit 导致 WebView2 卡死丢包。  
  *解法*：截屏存 Rust 全局 `LAST_SCREENSHOT` Mutex，前端仅感知信号，模型请求在 Rust 组装。
- [x] **踩坑 6：UIA 跨进程探测永久阻塞**  
  *原因*：部分非标准 Win32/DirectUI 窗口在响应 UIA 请求时无响应。  
  *解法*：必须带 150~200ms 强超时，超时立即 Fallback 到键盘模拟 + 剪贴板接力。
- [x] **踩坑 7：剪贴板监听回环与隐私泄露**  
  *原因*：自身程序向目标窗口粘贴文本触发剪贴板监听器，造成死循环；剪贴板包含密码等敏感数据。  
  *解法*：记录写入哈希忽略自身事件，前置手机号/身份证/密码管理器正则过滤。
- [x] **踩坑 8：CJK 中文 Diff 空格断词破坏排版**  
  *原因*：传统 Diff 按西方语言空格 Split，导致中文整句断裂。  
  *解法*：基于标点与 CJK 字符边界分词；对 LaTeX 公式与代码块做原样完整性校验。
- [x] **踩坑 9：版本号未同步导致自动更新校验失败**  
  *原因*：更新时仅修改了 `package.json`，遗漏了 `Cargo.toml` 或 `tauri.conf.json`。  
  *解法*：四位一体原子同步（`desktop/package.json`、`Cargo.toml`、`tauri.conf.json`、`Cargo.lock`）。
- [x] **踩坑 10：签名私钥内存驻留安全隐患**  
  *原因*：自动更新构建时私钥明文常驻内存或写在脚本中。  
  *解法*：私钥通过 Windows DPAPI 加密，PowerShell 临时解密为 `SecureString`，构建结束在 `finally` 块中调用 `ZeroFreeBSTR` 覆写清零内存。

---

## 3. 面向 AI 的系统铁律 (Never do / Always do)

### 3.1 绝对禁止 (Never do)
1. **Never**：严禁在异步探测（200ms）完成后才去获取前台 `target_hwnd`。
2. **Never**：严禁在 `BitBlt` 获取到有效画面后回退调用 `PrintWindow(..., PW_RENDERFULLCONTENT)`。
3. **Never**：严禁将原始 Base64 截图全量通过前端 IPC 传递。
4. **Never**：严禁在全自动发送模式中省略“最新消息来自对方 + 输入框文本 UIA 比对一致”确认链。
5. **Never**：严禁将 API Key、Tauri 签名私钥、用户聊天正文或截图写入代码、日志、提交或公共仓库。

### 3.2 必须遵循 (Always do)
1. **Always**：悬浮窗启动必须配置 `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`。
2. **Always**：多状态浮窗调整必须遵循“计算最终坐标 -> 原子更新位置尺寸 -> 显示聚焦”的几何排他锁机制。
3. **Always**：视觉多模态 Prompt 必须注入气泡方向事实，并强制要求无对话时返回空 JSON 结构。
4. **Always**：无 API Key 时必须自动回退至内置 Mock 流，保证开箱即用与测试畅通。
5. **Always**：发布前必须通过双级验证（`npm test -- --run` 与 `cargo test --manifest-path desktop/src-tauri/Cargo.toml`）。

---

## 4. 双端一芯与发布架构参考 (Architecture Baseline)

```text
[ Shared Core (纯 TypeScript) ]
  ├── Prompt 模板与视觉事实注入
  ├── CJK Myers Diff 字符比对引擎
  ├── 模型通信与统一流式解析协议 (extractJsonFromText)
  └── 统一类型定义与状态机契约
        ▲                     ▲
        │ 100% 共享            │ 100% 共享
        │                     │
[ Chrome MV3 扩展端 ]    [ Desktop 桌面端 (Tauri + Rust) ]
  ├── 页面内划词悬浮胶囊     ├── Win32 原生截屏 (BitBlt + 跳步采样 + Mutex)
  └── 浏览器内输入框适配     ├── UIA 跨进程焦点与输入框探测 (带 200ms 超时)
                            ├── 飞书/IM 人机协同预填与全自动双安全门发送
                            └── DPAPI 内存清零签名构建流水线
```

---

## 5. 📜 修撰履历与演进时间线 (Timeline)

- **2026-09-01 11:20** (`yanwh & Antigravity`)：`[增量升级]` 补充 Windows DWM 截屏抗旧帧污染、全黑跳步采样 512 点判定，以及 Windows DPAPI 签名私钥内存覆写清零机制。
- **2026-09-01 10:44** (`yanwh & Antigravity`)：`[初版归档]` 沉淀跨端 Tauri 原生透明悬浮窗、UIA 跨进程焦点探测与视觉多模态零幻觉架构。

