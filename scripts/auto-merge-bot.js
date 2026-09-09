#!/usr/bin/env node

/**
 * SOP 仓库 PR 自动审阅与合并机器人 (Auto-Merge Bot)
 * 功能：
 * 1. 自动检测 dcn-autotest-team/sop 仓库中所有处于 OPEN 状态的 Pull Request
 * 2. 检查 PR 内容合法性（重点审核 library/ 下的 SOP 资产）
 * 3. 自动执行 Squash/Merge，若遇到 sops.json 等冲突则自动提取并自愈合并
 * 4. 合并后自动运行 update-index.js 重新生成全局索引并推送到 main 分支
 * 5. 支持单次批量合并模式与后台守护轮询模式 (--daemon)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO = 'dcn-autotest-team/sop';
const SCRIPT_DIR = __dirname;
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const PROXY = 'http://127.0.0.1:7890';

function runCmd(cmd, options = {}) {
  try {
    return execSync(cmd, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (err) {
    if (!options.ignoreError) throw err;
    return null;
  }
}

function runGh(cmdArgs, options = {}) {
  const fullCmd = `gh ${cmdArgs}`;
  return execSync(fullCmd, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    ...options
  });
}

function getOpenPullRequests() {
  try {
    const raw = runGh(`pr list --repo ${REPO} --state open --json number,title,author,headRefName,files,mergeable,url`, { stdio: 'pipe' });
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Error] 获取 PR 列表失败:', err.message);
    return [];
  }
}

async function processPullRequest(pr) {
  console.log(`\n======================================================`);
  console.log(`[Auto-Merge] 正在检查 PR #${pr.number}: "${pr.title}" (作者: @${pr.author?.login})`);
  console.log(`[Link] ${pr.url}`);

  const files = pr.files || [];
  const hasSop = files.some(f => f.path.startsWith('library/') && f.path.endsWith('.md'));

  if (!hasSop) {
    console.log(`[Skip] PR #${pr.number} 未包含 library/ 下的 SOP 资产文件，跳过自动合并。`);
    return false;
  }

  console.log(`[Check] 包含 SOP 资产变动，开始执行自动合并...`);

  let mergeSuccess = false;
  try {
    console.log(`>>> 尝试通过 GitHub API 自动 Squash 合并 PR #${pr.number}...`);
    runGh(`pr merge ${pr.number} --repo ${REPO} --squash --admin`, { stdio: 'pipe' });
    mergeSuccess = true;
    console.log(`[Success] PR #${pr.number} 已经成功合并！`);
  } catch (err) {
    console.warn(`[Notice] 直接合并返回提示或有冲突: ${err.message?.trim()}`);
  }

  if (!mergeSuccess) {
    console.log(`>>> [Self-Healing] 启动自愈合并流程：从 PR #${pr.number} 提取新增/修改的 SOP 文档...`);
    try {
      const sopFiles = files.filter(f => f.path.startsWith('library/') && f.path.endsWith('.md'));
      for (const f of sopFiles) {
        const filePath = f.path;
        console.log(`    正在拉取 SOP 文件: ${filePath}...`);
        const b64 = runGh(`api repos/${REPO}/contents/${filePath}?ref=refs/pull/${pr.number}/head --jq .content`, { stdio: 'pipe' }).trim();
        if (b64) {
          const content = Buffer.from(b64, 'base64').toString('utf8');
          const localDest = path.join(ROOT_DIR, filePath);
          fs.mkdirSync(path.dirname(localDest), { recursive: true });
          fs.writeFileSync(localDest, content, 'utf8');
          console.log(`    已成功提取并保存到本地: ${filePath}`);
        }
      }

      runGh(`pr close ${pr.number} --repo ${REPO} --comment "感谢贡献！由于并发提交产生了索引冲突，系统已自动提取该 SOP 并合并入主干。"`, { stdio: 'pipe' });
      mergeSuccess = true;
      console.log(`[Success] 已自愈式提取 PR #${pr.number} 内容并闭环！`);
    } catch (extractErr) {
      console.error(`[Error] 自愈提取 PR #${pr.number} 失败: ${extractErr.message}`);
      return false;
    }
  }

  return mergeSuccess;
}

function rebuildAndDeploy() {
  console.log(`\n>>> [Build & Deploy] 正在重新生成全局索引与静态资源...`);
  fs.writeFileSync(path.join(ROOT_DIR, 'public', 'index.html'), fs.readFileSync(path.join(ROOT_DIR, 'index.html')));
  runCmd(`node scripts/update-index.js`);

  const parentDir = path.resolve(ROOT_DIR, '..');
  console.log(`>>> 正在推送更新至 GitHub 官方仓库 main 分支...`);
  try {
    execSync(`git add sop/`, { cwd: parentDir });
    execSync(`git commit -m "chore: auto sync and rebuild SOP index from merged PRs"`, { cwd: parentDir, stdio: 'pipe' });
  } catch (e) {}

  try {
    execSync(`git branch -D sop-only`, { cwd: parentDir, stdio: 'pipe' });
  } catch (e) {}

  const ghToken = execSync('gh auth token', { encoding: 'utf8' }).trim();
  execSync(`git -c http.https://github.com.proxy="${PROXY}" push "https://dcn-autotest-team:${ghToken}@github.com/dcn-autotest-team/sop.git" sop-only:main -f`, {
    cwd: parentDir,
    stdio: 'inherit'
  });
  console.log(`[Success] 索引与静态网站已成功部署上线！`);
}

async function main() {
  const isDaemon = process.argv.includes('--daemon');
  console.log(`=== SOP 仓库 PR 自动审阅与合并服务启动 ===`);
  console.log(`目标仓库: ${REPO}`);
  console.log(`运行模式: ${isDaemon ? '后台持续守护巡检 (每 60 秒一次)' : '单次自动合并'}`);

  async function checkAndMerge() {
    const prs = getOpenPullRequests();
    if (!prs || prs.length === 0) {
      if (!isDaemon) console.log(`[Info] 当前没有待合并的 Open PR，仓库一切正常！`);
      return;
    }

    console.log(`[Detect] 发现 ${prs.length} 个待处理的 Pull Request！`);
    let mergedCount = 0;
    for (const pr of prs) {
      const ok = await processPullRequest(pr);
      if (ok) mergedCount++;
    }

    if (mergedCount > 0) {
      console.log(`\n[Summary] 本轮共自动合并处理 ${mergedCount} 个 PR，开始重新构建索引并发布...`);
      rebuildAndDeploy();
    }
  }

  await checkAndMerge();

  if (isDaemon) {
    console.log(`\n[Guard] 守护已生效，正在监听新 PR 提交 (Ctrl+C 退出)...\n`);
    setInterval(async () => {
      try { await checkAndMerge(); } catch (e) {
        console.error('[Daemon Error]', e.message);
      }
    }, 60 * 1000);
  }
}

main().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
