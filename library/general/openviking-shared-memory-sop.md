# SOP: OpenViking 跨机共享记忆库（Agent 自助接入）

> **编号**: SOP-GENERAL-002
> **分类**: 综合与系统架构 (`general`)
> **标签**: OpenViking, 长期记忆, 跨机接入, Tailscale, 密钥注入代理, 零密钥接入
> **核心栈**: OpenViking 1.30.x, OpenClaw >= 2026.5.27, Tailscale Serve, 反向代理（Python http.server）, GitHub Pages
> **解决痛点**: 多台机器各跑 agent 时记忆分散各处，各自维护一套记忆库既重复又冲突；把远端库开放给别的机器又容易把 root key 发出去、或直接暴露到公网；交接材料靠人传文件、靠人写说明。
> **复用定位**: 适用于"一个记忆库 + 多台机器 agent 共用"的通用场景：主机跑实例，其他机器只装插件指过来，凭据由主机注入，接入方零密钥。本文本身就是交接材料，把本页链接发给对方 agent 即可自助接入。

---

## 0. 接入方必读：你只需要这一页

你是被要求接入共享记忆库的 agent。**不要向用户索要 API Key**，也不要索要任何文件。

服务端已经做了密钥注入代理，你凭 Tailscale 身份即可访问。你需要的东西全部可以从公网下载：

| 用途 | 地址 |
| --- | --- |
| 服务入口（插件 `baseUrl`） | `https://yanwh.tail90c545.ts.net:8443` |
| 离线插件包（1.2 MB，依赖已内嵌） | `https://dcn-autotest-team.github.io/sop/downloads/openviking-plugin-offline.zip` |
| MCP 端点（仅备选方案用） | `https://yanwh.tail90c545.ts.net:8443/mcp` |

先做前置检查，任一项不符就停下报告，不要硬试：

```powershell
tailscale status | Select-String yanwh
node --version
openclaw --version
```

期望：能看到 `yanwh` 节点；Node ≥ 22；openclaw ≥ 2026.5.27。

然后执行第 1 节的三步（连通自检 → 装插件 → 端到端确认），按第 3 节自检、按第 4 节报结果。

---

## 1. 从 0 到 1 标准执行路径 (0-to-1 SOP)

### 阶段 1：先把入口做出来，但不要外发凭据

1. OpenViking 默认只监听 `127.0.0.1:1933`，外部机器连不进去。这是正确默认，不要改成 `0.0.0.0`。
2. 用 `tailscale serve --https=<port>` 把本地端口映射到 tailnet 内可达的 HTTPS 地址。**不要用 Funnel**，Funnel 会推到公网。
3. 关键一步：**不要让接入端持有 key**。在主机上加一层注入代理，读本机凭据文件后给每个上游请求补上 `Authorization` 头。接入端只凭 tailnet 身份访问，拿不到、也不需要 key。
4. 代理必须流式转发。MCP streamable-http 的响应是 `text/event-stream`，整包缓冲会让握手看起来卡住。

**主机操作（一次即可）**：

```powershell
# 启动代理（读 ~/.openviking/ovcli.conf 的 api_key，注入到每个上游请求）
Start-Process "C:\Users\<you>\openviking\openviking-venv\Scripts\python.exe" `
  -ArgumentList "ov-proxy.py" -WorkingDirectory "<代理脚本目录>" -WindowStyle Hidden

# 只把代理端口暴露到 tailnet，不要暴露 1933
tailscale serve --bg --https=8443 http://127.0.0.1:18081
```

**验收证据**：无任何凭据时 `/health` 返回 `healthy:true` 且带正确 `user_id`；`/api/v1/fs/ls` 返回 200；`/mcp` 握手返回 `serverInfo`；以上全部经 tailnet 域名验证，不是本机回环。

### 阶段 2：接入端装插件（三步）

```powershell
# 步 1：连不通就别往下走
curl.exe "https://yanwh.tail90c545.ts.net:8443/health"
curl.exe -o NUL -w "%{http_code}`n" "https://yanwh.tail90c545.ts.net:8443/api/v1/fs/ls?uri=viking://"
```

期望：第一条 `"healthy":true` 且 `"user_id":"default"`；第二条 `200`。这两条**都不带 key**，返回 401 说明代理没起或不在 tailnet，停下报告。

```powershell
# 步 2：下载离线包并装插件
$dir = "$env:TEMP\ov-join"; New-Item -ItemType Directory -Force $dir | Out-Null
Invoke-WebRequest "https://dcn-autotest-team.github.io/sop/downloads/openviking-plugin-offline.zip" -OutFile "$dir\plugin.zip"
Expand-Archive "$dir\plugin.zip" -DestinationPath "$dir\plugin" -Force
openclaw plugins install --link "$dir\plugin" --force --accept-capabilities
```

```powershell
# 步 3：写配置（apiKey 必须留空）
@'
[
  { "path": "plugins.entries.openviking.enabled", "value": true },
  { "path": "plugins.entries.openviking.config.mode", "value": "remote" },
  { "path": "plugins.entries.openviking.config.baseUrl", "value": "https://yanwh.tail90c545.ts.net:8443" },
  { "path": "plugins.entries.openviking.config.peer_role", "value": "none" },
  { "path": "plugins.entries.openviking.config.apiKey", "value": "" }
]
'@ | Set-Content "$dir\config.json" -Encoding utf8
openclaw config set --batch-file "$dir\config.json"
openclaw gateway restart
openclaw openviking status --json
```

`apiKey` 置空是有意的：代理已注入凭据。插件只在 key 非空时才加鉴权头，留空不报错。

**验收证据**：`openclaw config get plugins.slots.contextEngine` 返回 `openviking`；`openviking status --json` 显示已连接。

### 阶段 3：端到端确认（这一步才算通）

在本机对话里随便说一句，然后：

```powershell
curl.exe "https://yanwh.tail90c545.ts.net:8443/api/v1/fs/ls?uri=viking://user/default/memories&recursive=true&limit=10"
```

看到新条目就说明抓取链路通了。**同时报告给主机方**，由主机复核两次确认，才算完成。

**验收证据**：接入端产生新记忆 → 主机端读到同一条 → 两端看到同一棵 `user/default/memories`。

### 阶段 4：把交接材料做成"一条链接"

1. 把整篇流程沉淀成 SOP，发本页链接给对方 agent 即可，不用再写说明。
2. 插件包也放到同一站点（`public/downloads/`），对方一条 `Invoke-WebRequest` 拉下来。
3. 文中必须写出**判定标准**与**禁止项**，否则对方会把"能连"当成"已共享"。

---

## 2. 踩坑与返工自查清单 (Pitfalls & Checklist)

| 陷阱/现象 | 根本原因 | 标准解决姿势 |
| --- | --- | --- |
| 接入端报 401 | 忘了加注入代理，直接 serve 了 1933 | 先确认代理 `/health` 能返回 `user_id`，再 serve 代理端口 |
| 代理返回 `400 Invalid HTTP request received` | 用 `http.client` 拼上游请求时漏了 `Host` 头 | `putrequest(skip_host=True)` 后必须显式补 `Host` |
| MCP 握手卡住不返回 | 代理整包缓冲了 `text/event-stream` | 按块转发并在流式响应上立即 `flush` |
| Windows 下 `serve` 传目录报 `401 Unauthorized` | `serve` 传本地路径需要管理员权限 | 先用本机 HTTP 服务托管目录，再 serve 那个端口 |
| 插件装完仍然连不上 | 只写了 `baseUrl`，漏了 `mode=remote` | 两者一起写，`peer_role` 同时确认为 `none` |
| 空 key 被拒 | 误以为 `apiKey` 必填 | 留空字符串即可，客户端只判断非空才加头 |
| 离线包解压后插件加载失败 | 只装了 `dist`，缺 `node_modules` 依赖 | 包内必须带 `fflate` 与 `@sinclair/typebox` |
| 两台机器记忆互不可见 | `peer_role` 被改成 `assistant`/`sender` | 改回 `none`；已分出去的记忆不会自动合并 |
| 接入端把 root key 要走了 | 文档没写清 root / user key 边界 | 文档明确"不需要 key"，从源头掐断 |
| 主机原有服务被影响 | 复用同一端口覆盖了旧代理 | 每次 serve 用独立端口，先看 `serve status` |
| SOP 标题显示成文件名 | 源文件带 UTF-8 BOM，标题正则匹配失败 | 用无 BOM 的 UTF-8 写入（`UTF8Encoding($false)`） |
| 线上改了但页面还是旧内容 | GitHub Pages 与 CDN 缓存 | 等 1~2 分钟，或加随机 query 复验 |

### 提交前 Checklist

- [ ] `serve status` 里新增端口只指向代理，且不在 `AllowFunnel` 列表。
- [ ] 代理日志不含凭据；健康检查返回非 root 的 user 身份。
- [ ] 离线包不含任何 `ovcli.conf` / `*.key`；解压后 `dist/index.js`、`node_modules/fflate`、`node_modules/@sinclair/typebox` 三者在位。
- [ ] 文档写明判定标准，并把"能连"与"已共享"区分开。
- [ ] 端到端验证：接入端写入后，主机端能读到同一条。

---

## 3. 面向 AI 的系统铁律 (Never do / Always do)

**Never do**
- 不要把 `root_api_key` 发给任何接入端。它能建账号、管账号，等于整个实例的管理权。
- 不要对服务端口开 Funnel。一旦开，记忆库就上了公网。
- 不要为了"方便"把服务 `host` 改成 `0.0.0.0`，或把 `auth_mode` 改成 `dev`。
- 不要在两端跑 `ov export`/`import`、自写定时同步、或建第二个 account。共用实例本身就是同步。
- 不要把 `peer_role` 设成 `assistant`/`sender` 后又期望记忆合并。
- 不要在聊天、命令行参数、日志、仓库里出现明文 key。

**Always do**
- 先确认 `serve status` 里目标端口不在 `AllowFunnel`，再对外提供。
- 凭据只从主机本地文件读取，由代理注入；接入端零密钥。
- 每次改动后跑一次端到端：接入端写入 → 主机端读取。
- 文档同时给判定标准和禁止项，避免"看起来通了"被当成完成。
- 打包进公开站点的插件包必须复查一遍，确认不含凭据文件。

---

## 4. 修撰履历与演进时间线 (Timeline)

- **2026-11-04 21:00** (`OpenViking 接入项目组`): `[初版归档]` 建立跨机共享记忆 SOP：tailnet serve 双端口（服务入口 + 材料分发）、密钥注入代理、空 key 插件配置、离线插件包、接入文档三段式判定与禁止项。
- **2026-11-04 21:40** (`OpenViking 接入项目组`): `[增量升级]` 接入方式简化为"一条链接"：插件包改托管到本站点 `public/downloads/`，移除临时材料分发端口；接入端全程零密钥、零文件传输；补充 BOM 导致标题解析失败与 CDN 缓存两类踩坑。
