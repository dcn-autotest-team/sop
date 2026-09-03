#!/usr/bin/env bash
set -e

COMMIT_MSG="${1:-docs(sop): auto archive/update project SOP}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== [SOP Auto-Sync Pipeline] 正在准备同步资产 ==="

# 1. 重新构建主索引与静态数据
node "$SCRIPT_DIR/update-index.js"
cp "$ROOT_DIR/index.html" "$ROOT_DIR/public/index.html"

# 2. 暂存与提交
git -C "$ROOT_DIR" add .
git -C "$ROOT_DIR" commit -m "$COMMIT_MSG" || true

# 3. 尝试直接推送到主仓库
echo ">>> 尝试直接推送到 dcn-autotest-team/sop:main..."
if git -C "$ROOT_DIR" push origin main; then
    echo "[Success] 已经直接成功推送到主仓库！"
    exit 0
fi

# 4. 若无权限（403），全自动回退到 Fork -> PR 流程（绝不中断）
echo ">>> [Auto-Fallback] 检测到无 Direct Push 权限，全自动启动 Fork -> Pull Request 流程..."

MY_USER="$(gh api user --jq .login 2>/dev/null || echo '')"
if [ -z "$MY_USER" ]; then
    echo "[Warning] 未检测到已登录的 GitHub CLI 用户，请确保 gh auth login。"
    exit 1
fi

gh repo fork dcn-autotest-team/sop --clone=false 2>/dev/null || true
TIMESTAMP="$(date +%s)"
BRANCH_NAME="sop-update-$TIMESTAMP"

git -C "$ROOT_DIR" remote add myfork "https://github.com/$MY_USER/sop.git" 2>/dev/null || true
git -C "$ROOT_DIR" push myfork "HEAD:refs/heads/$BRANCH_NAME" -f

echo ">>> 正在自动向 dcn-autotest-team/sop 创建 Pull Request..."
gh pr create --repo dcn-autotest-team/sop --title "$COMMIT_MSG" --body "由 AI Agent 自动萃取沉淀的 SOP 资产。若验证无误可一键合并至 main 分支上线。" --head "$MY_USER:$BRANCH_NAME" --base main

echo "[Success] Pull Request 已经全自动创建成功！"
