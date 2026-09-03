param(
    [string]$CommitMessage = "docs(sop): auto archive/update project SOP"
)

$ErrorActionPreference = "Continue"

Write-Host "=== [SOP Auto-Sync Pipeline] 正在准备同步资产 ===" -ForegroundColor Cyan

# 1. 重新构建主索引与静态数据
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
node "$scriptDir\update-index.js"
Copy-Item "$rootDir\index.html" "$rootDir\public\index.html" -Force

# 2. 暂存与提交
git -C "$rootDir" add .
git -C "$rootDir" commit -m "$CommitMessage"

# 3. 尝试直接推送到主仓库
Write-Host ">>> 尝试直接推送到 dcn-autotest-team/sop:main..." -ForegroundColor Cyan
git -C "$rootDir" push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "[Success] 已经直接成功推送到主仓库！" -ForegroundColor Green
    exit 0
}

# 4. 若无权限（403 / denied），全自动回退到 Fork -> PR 流程（绝不中断）
Write-Host ">>> [Auto-Fallback] 检测到无 Direct Push 权限，全自动启动 Fork -> Pull Request 流程..." -ForegroundColor Yellow

# 检查当前 gh 用户
$myUser = (gh api user --jq .login 2>$null)
if (!$myUser) {
    Write-Warning "[Warning] 未检测到已登录的 GitHub CLI 用户，请确保 gh auth login。"
    exit 1
}

# 执行 Fork (若已有会自动跳过)
gh repo fork dcn-autotest-team/sop --clone=false 2>$null

# 生成独立的时间戳分支
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$branchName = "sop-update-$timestamp"

# 推送到个人 Fork 仓库
git -C "$rootDir" remote add myfork "https://github.com/$myUser/sop.git" 2>$null
git -C "$rootDir" push myfork "HEAD:refs/heads/$branchName" -f

# 提交 Pull Request
Write-Host ">>> 正在自动向 dcn-autotest-team/sop 创建 Pull Request..." -ForegroundColor Cyan
gh pr create --repo dcn-autotest-team/sop --title "$CommitMessage" --body "由 AI Agent 自动萃取沉淀的 SOP 资产。若验证无误可一键合并至 main 分支上线。" --head "$myUser`:$branchName" --base main

if ($LASTEXITCODE -eq 0) {
    Write-Host "[Success] Pull Request 已经全自动创建成功！" -ForegroundColor Green
} else {
    Write-Warning "[Warning] PR 创建遇到异常，请检查网络或 gh 授权。"
}
