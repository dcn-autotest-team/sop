/**
 * GitHub Issue 转 SOP 自动化解析脚本
 * 当任何人在 GitHub 上提交带有 [SOP] 的 Issue 时，由 GitHub Actions 调用本脚本完成全自动入库
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const LIBRARY_DIR = path.join(ROOT_DIR, 'library');

async function main() {
  const issueTitle = process.env.ISSUE_TITLE || '';
  const issueBody = process.env.ISSUE_BODY || '';
  const issueAuthor = process.env.ISSUE_AUTHOR || 'Community Contributor';
  const issueNumber = process.env.ISSUE_NUMBER || '';

  if (!issueBody.trim()) {
    console.error('[Error] Issue 正文为空，无法沉淀为 SOP。');
    process.exit(1);
  }

  // 1. 提取标题
  let title = issueTitle.replace(/^\[?SOP\]?[:：\s]*/i, '').trim();
  const bodyTitleMatch = issueBody.match(/^#\s+(?:SOP[:：]\s*)?(.+)$/m);
  if (bodyTitleMatch) {
    title = bodyTitleMatch[1].trim();
  }
  if (!title) title = '未命名沉淀资产';

  // 2. 提取分类
  let category = 'general';
  const catMatch = issueBody.match(/\*\*分类\*\*[:：]\s*([a-zA-Z0-9_-]+|[\u4e00-\u9fa5]+)/i);
  if (catMatch) {
    const rawCat = catMatch[1].toLowerCase().trim();
    if (rawCat.includes('agent') || rawCat.includes('ai')) category = 'ai-agent';
    else if (rawCat.includes('front') || rawCat.includes('前端')) category = 'frontend';
    else if (rawCat.includes('back') || rawCat.includes('后端') || rawCat.includes('服务')) category = 'backend';
    else if (rawCat.includes('auto') || rawCat.includes('脚本') || rawCat.includes('自动化')) category = 'automation';
    else category = 'general';
  }

  // 3. 生成安全文件名 (slug)
  let slug = title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  if (!slug) slug = `sop-${Date.now()}`;

  const targetDir = path.join(LIBRARY_DIR, category);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const targetFile = path.join(targetDir, `${slug}.md`);

  // 4. 检查是否需要更新时间线
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 16).replace('T', ' ');

  let finalContent = issueBody;

  // 如果没有包含修撰履历章节，自动在末尾追加
  if (!issueBody.includes('修撰履历') && !issueBody.includes('演进履历') && !issueBody.includes('Timeline')) {
    finalContent += `\n\n---\n\n## 📜 修撰履历与演进时间线 (Timeline)\n\n- **${dateStr}** (\`${issueAuthor} & AI Agent\`): \`[社区贡献归档]\` 通过 GitHub Issue #${issueNumber} 自动提交并并入主库。\n`;
  }

  fs.writeFileSync(targetFile, finalContent, 'utf8');
  console.log(`[Success] 成功将 Issue #${issueNumber} 写入: library/${category}/${slug}.md`);

  // 5. 重新构建主索引
  const updateScript = path.join(ROOT_DIR, 'scripts', 'update-index.js');
  execSync(`node "${updateScript}"`, { stdio: 'inherit' });
}

main().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
