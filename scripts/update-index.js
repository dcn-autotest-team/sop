/**
 * SOP 资产扫描与索引重建脚本
 * 纯文字排版（无 emoji），具备自动查重、标题唯一性校验、演进时间线提取与索引智能重建功能
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
  'frontend': '前端与交互开发',
  'backend': '后端与服务端',
  'ai-agent': 'AI 与 Agent 开发',
  'automation': '自动化与脚本',
  'general': '综合与通用架构'
};

const sops = [];
const seenIds = new Set();
const seenTitles = new Map();

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

    const id = `${cat}-${file.replace(/\.md$/, '')}`;

    // 查重校验
    if (seenIds.has(id)) {
      console.warn(`[Deduplication Warning] 发现重复的 SOP ID: ${id}，将自动保留最新内容。`);
      return;
    }
    seenIds.add(id);

    if (seenTitles.has(title.toLowerCase())) {
      console.warn(`[Deduplication Warning] 发现相近标题: "${title}" (已有: ${seenTitles.get(title.toLowerCase())})，建议合并为同一篇 SOP 资产。`);
    } else {
      seenTitles.set(title.toLowerCase(), file);
    }

    // 提取演进时间线 (Timeline / Changelog)
    const timeline = [];
    const timelineSection = content.match(/##\s+[\d\.\s]*(?:📜\s*)?(?:修撰履历|演进履历|版本演进|时间线|Timeline|Changelog)[^\n]*\n([\s\S]*?)(?:\n##|$)/i);
    if (timelineSection && timelineSection[1]) {
      const lines = timelineSection[1].split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('-')) return;
        // 匹配格式: - **2026-09-01 11:20** (`yanwh & Antigravity`)：`[增量升级]` 补充...
        const m = trimmed.match(/^-\s*\*\*([^*]+)\*\*\s*(?:\(([^)]+)\))?[：:]\s*(?:`?\[([^\]]+)\]`?)?\s*(.+)$/);
        if (m) {
          timeline.push({
            date: m[1].trim(),
            author: (m[2] || 'yanwh & AI Agent').replace(/[`]/g, '').trim(),
            tag: (m[3] || '增量更新').replace(/[`]/g, '').trim(),
            desc: m[4].trim()
          });
        }
      });
    }

    // 若无明确履历，则根据文件元数据生成初版记录
    const stat = fs.statSync(fullPath);
    if (timeline.length === 0) {
      timeline.push({
        date: stat.mtime.toISOString().slice(0, 16).replace('T', ' '),
        author: 'yanwh & AI Agent',
        tag: '初版归档',
        desc: '项目标准实践初次沉淀入库。'
      });
    }

    sops.push({
      id,
      category: cat,
      filename: file,
      relPath: `library/${cat}/${file}`,
      title,
      tech,
      pain,
      content,
      timeline,
      updatedAt: stat.mtime.toISOString()
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

// 写入 INDEX.md (纯净无 emoji)
let md = `# SOP 知识资产总索引库 (Master Index)\n\n`;
md += `> 本文件由 SOP 引擎自动同步维护。每次沉淀新项目时自动追加，需要查阅时自动检索。\n`;
md += `> 状态：正常 | 收录总数：${sops.length} 篇 | 最近更新：${new Date().toLocaleDateString('zh-CN')}\n\n`;
md += `---\n\n## 快速检索导航\n\n`;
md += `| 场景分类 | 目录路径 | 已收录资产数 | 涵盖核心技术栈 |\n`;
md += `| :--- | :--- | :--- | :--- |\n`;

CATEGORIES.forEach(cat => {
  const count = sops.filter(s => s.category === cat).length;
  md += `| **${categoryNames[cat]}** | [\`library/${cat}/\`](./library/${cat}/) | ${count} | ${cat === 'ai-agent' ? 'LangChain, RAG, Tauri, Prompt工程, Agent工作流' : '标准生产实践'} |\n`;
});

md += `\n---\n\n## 已沉淀资产清单 (Assets Catalog)\n\n`;

CATEGORIES.forEach(cat => {
  const catSops = sops.filter(s => s.category === cat);
  md += `### ${categoryNames[cat]} (\`library/${cat}/\`)\n`;
  if (catSops.length === 0) {
    md += `*暂无资产，等待沉淀...*\n\n`;
  } else {
    catSops.forEach((sop, idx) => {
      const historyCount = sop.timeline ? ` (${sop.timeline.length} 次修撰)` : '';
      md += `- **[${sop.category.toUpperCase()}-${String(idx + 1).padStart(3, '0')}] [${sop.title}](./${sop.relPath})**${historyCount}\n`;
      md += `  - **核心技术**：${sop.tech}\n`;
      md += `  - **解决痛点**：${sop.pain}\n`;
    });
    md += `\n`;
  }
});

fs.writeFileSync(INDEX_FILE, md, 'utf8');
console.log(`[Update-Index] 成功重新构建索引！共收录 ${sops.length} 篇 SOP 资产。`);
