/**
 * SOP 资产扫描与索引重建脚本
 * 自动遍历 library/ 目录，提取元数据并重新生成 sops.json、public/sops.json 与 INDEX.md
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LIBRARY_DIR = path.join(ROOT_DIR, 'library');
const INDEX_FILE = path.join(ROOT_DIR, 'INDEX.md');
const SOPS_JSON_FILE = path.join(ROOT_DIR, 'sops.json');
const PUBLIC_SOPS_JSON_FILE = path.join(ROOT_DIR, 'public', 'sops.json');

const CATEGORIES = ['frontend', 'backend', 'ai-agent', 'automation', 'general'];
const categoryNames = {
  'frontend': '🌐 前端与交互开发',
  'backend': '⚙️ 后端与服务端',
  'ai-agent': '🤖 AI 与 Agent 开发',
  'automation': '🕷️ 自动化与脚本',
  'general': '📦 综合与通用架构'
};

const sops = [];

CATEGORIES.forEach(cat => {
  const dir = path.join(LIBRARY_DIR, cat);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    if (!file.endsWith('.md')) return;
    const fullPath = path.join(dir, file);
    const content = fs.readFileSync(fullPath, 'utf8');

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].replace(/^SOP:\s*/i, '').trim() : file;

    const techMatch = content.match(/\*\*核心(?:技术|栈)\*\*[:：]\s*(.+)$/m);
    const tech = techMatch ? techMatch[1].trim() : '通用规范';

    const painMatch = content.match(/\*\*解决痛点\*\*[:：]\s*(.+)$/m);
    const pain = painMatch ? painMatch[1].trim() : '项目标准化与避坑';

    sops.push({
      id: `${cat}-${file.replace(/\.md$/, '')}`,
      category: cat,
      filename: file,
      relPath: `library/${cat}/${file}`,
      title,
      tech,
      pain,
      content,
      updatedAt: fs.statSync(fullPath).mtime.toISOString()
    });
  });
});

// 按更新时间倒序
sops.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

// 写入 sops.json
fs.writeFileSync(SOPS_JSON_FILE, JSON.stringify(sops, null, 2), 'utf8');
if (fs.existsSync(path.dirname(PUBLIC_SOPS_JSON_FILE))) {
  fs.writeFileSync(PUBLIC_SOPS_JSON_FILE, JSON.stringify(sops, null, 2), 'utf8');
}

// 写入 INDEX.md
let md = `# 📚 SOP 知识资产总索引库 (Master Index)\n\n`;
md += `> 本文件由 **SOP 引擎** 自动同步维护。每次沉淀新项目时自动追加，需要查阅时自动检索。\n`;
md += `> 状态：🟢 运行中 | 收录总数：${sops.length} 篇 | 最近更新：${new Date().toLocaleDateString('zh-CN')}\n\n`;
md += `---\n\n## 快速检索导航\n\n`;
md += `| 场景分类 | 目录路径 | 已收录资产数 | 涵盖核心技术栈 |\n`;
md += `| :--- | :--- | :--- | :--- |\n`;

CATEGORIES.forEach(cat => {
  const count = sops.filter(s => s.category === cat).length;
  md += `| **${categoryNames[cat]}** | [\`library/${cat}/\`](./library/${cat}/) | ${count} | ${cat === 'ai-agent' ? 'LangChain, RAG, Tauri, Prompt工程, Agent工作流' : '标准生产实践'} |\n`;
});

md += `\n---\n\n## 🗂️ 已沉淀资产清单 (Assets Catalog)\n\n`;

CATEGORIES.forEach(cat => {
  const catSops = sops.filter(s => s.category === cat);
  md += `### ${categoryNames[cat]} (\`library/${cat}/\`)\n`;
  if (catSops.length === 0) {
    md += `*暂无资产，等待沉淀...*\n\n`;
  } else {
    catSops.forEach((sop, idx) => {
      md += `- **[${sop.category.toUpperCase()}-${String(idx + 1).padStart(3, '0')}] [${sop.title}](./${sop.relPath})**\n`;
      md += `  - **核心技术**：${sop.tech}\n`;
      md += `  - **解决痛点**：${sop.pain}\n`;
    });
    md += `\n`;
  }
});

fs.writeFileSync(INDEX_FILE, md, 'utf8');
console.log(`[Update-Index] 成功重新构建索引！共收录 ${sops.length} 篇 SOP。`);
