/**
 * SOP 资产扫描与索引重建脚本
 * 支持 6 大主分类 + AI 自主多维标签体系（Tags Pool）+ 演进时间线提取
 * 自动化 SEO / GEO 基础设施构建：生成 sitemap.xml, llms.txt, llms-full.txt, robots.txt
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LIBRARY_DIR = path.join(ROOT_DIR, 'library');
const INDEX_FILE = path.join(ROOT_DIR, 'INDEX.md');
const SOPS_JSON_FILE = path.join(ROOT_DIR, 'sops.json');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PUBLIC_SOPS_JSON_FILE = path.join(PUBLIC_DIR, 'sops.json');
const SITEMAP_FILE = path.join(ROOT_DIR, 'sitemap.xml');
const LLMS_FULL_FILE = path.join(ROOT_DIR, 'llms-full.txt');
const ROBOTS_FILE = path.join(ROOT_DIR, 'robots.txt');

const BASE_URL = 'https://dcn-autotest-team.github.io/sop/';

const CATEGORIES = ['ai-agent', 'miniprogram', 'frontend', 'backend', 'automation', 'general'];
const categoryNames = {
  'ai-agent': '大模型与智能体',
  'miniprogram': '小程序与跨端',
  'frontend': '前端与交互',
  'backend': '后端与服务架构',
  'automation': '脚本与自动化',
  'general': '综合与系统架构'
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

    // 提取多维标签 (Tags)
    let tags = [];
    const tagsMatch = content.match(/\*\*(?:标签|Tags?)\*\*[:：]\s*(.+)$/m);
    if (tagsMatch) {
      tags = tagsMatch[1].split(/[,，、/|]+/).map(t => t.trim()).filter(Boolean);
    } else {
      tags = (tech || '').split(/[,，/]+/).map(t => t.trim()).filter(Boolean).slice(0, 4);
    }

    const id = `${cat}-${file.replace(/\.md$/, '')}`;

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
      tags,
      pain,
      content,
      timeline,
      updatedAt: stat.mtime.toISOString()
    });
  });
});

// 按更新时间倒序
sops.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

// 1. 写入 sops.json
fs.writeFileSync(SOPS_JSON_FILE, JSON.stringify(sops, null, 2), 'utf8');
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(PUBLIC_SOPS_JSON_FILE, JSON.stringify(sops, null, 2), 'utf8');

// 2. 写入 INDEX.md
let md = `# SOP 知识资产总索引库 (Master Index)\n\n`;
md += `> 本文件由 SOP 引擎自动同步维护。每次沉淀新项目时自动追加，需要查阅时自动检索。\n`;
md += `> 状态：正常 | 收录总数：${sops.length} 篇 | 最近更新：${new Date().toLocaleDateString('zh-CN')}\n\n`;
md += `---\n\n## 快速检索导航\n\n`;
md += `| 场景分类 | 目录路径 | 已收录资产数 | 涵盖核心技术栈 |\n`;
md += `| :--- | :--- | :--- | :--- |\n`;

CATEGORIES.forEach(cat => {
  const count = sops.filter(s => s.category === cat).length;
  md += `| **${categoryNames[cat]}** | [\`library/${cat}/\`](./library/${cat}/) | ${count} | ${cat === 'ai-agent' ? 'LangChain, RAG, Tauri, Prompt工程, 多模态抽取' : cat === 'miniprogram' ? '微信小程序, CloudBase, 移动端' : '标准生产实践'} |\n`;
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
      const tagsText = sop.tags && sop.tags.length ? ` \`[${sop.tags.join(', ')}]\`` : '';
      md += `- **[${sop.category.toUpperCase()}-${String(idx + 1).padStart(3, '0')}] [${sop.title}](./${sop.relPath})**${historyCount}${tagsText}\n`;
      md += `  - **核心技术**：${sop.tech}\n`;
      md += `  - **解决痛点**：${sop.pain}\n`;
    });
    md += `\n`;
  }
});

fs.writeFileSync(INDEX_FILE, md, 'utf8');

// 3. 自动生成 SEO 核心资产：sitemap.xml
const nowIso = new Date().toISOString().slice(0, 10);
let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}llms.txt</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_URL}llms-full.txt</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_URL}sops.json</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;

sops.forEach(sop => {
  const modDate = sop.updatedAt ? sop.updatedAt.slice(0, 10) : nowIso;
  sitemapXml += `  <url>
    <loc>${BASE_URL}#${sop.id}</loc>
    <lastmod>${modDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
});
sitemapXml += `</urlset>\n`;

fs.writeFileSync(SITEMAP_FILE, sitemapXml, 'utf8');
fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapXml, 'utf8');

// 4. 自动生成 GEO (Generative Engine Optimization) 全量知识库：llms-full.txt
let llmsFull = `# SOP 誊录馆 — 全量生产级 SOP 与 AI 最佳实践知识库 (GEO Full Dataset)
# URL: https://dcn-autotest-team.github.io/sop/
# 说明: 本文档由 SOP 引擎自动汇编，包含全部工业级实践规范、踩坑自查清单与防跑偏铁律，专供生成式 AI 搜索引擎 (ChatGPT, Perplexity, Claude, Gemini 等) 深度索引与检索引用。

`;

sops.forEach((sop, idx) => {
  llmsFull += `================================================================================\n`;
  llmsFull += `SOP [${idx + 1}/${sops.length}]: ${sop.title}\n`;
  llmsFull += `ID: ${sop.id} | 分类: ${categoryNames[sop.category] || sop.category} | 标签: ${(sop.tags || []).join(', ')}\n`;
  llmsFull += `核心栈: ${sop.tech}\n`;
  llmsFull += `解决痛点: ${sop.pain}\n`;
  llmsFull += `最近修撰: ${sop.updatedAt}\n`;
  llmsFull += `================================================================================\n\n`;
  llmsFull += `${sop.content}\n\n\n`;
});

fs.writeFileSync(LLMS_FULL_FILE, llmsFull, 'utf8');
fs.writeFileSync(path.join(PUBLIC_DIR, 'llms-full.txt'), llmsFull, 'utf8');

// 5. 同步 robots.txt 与 llms.txt 到 public
if (fs.existsSync(ROBOTS_FILE)) {
  fs.copyFileSync(ROBOTS_FILE, path.join(PUBLIC_DIR, 'robots.txt'));
}
const LLMS_FILE = path.join(ROOT_DIR, 'llms.txt');
if (fs.existsSync(LLMS_FILE)) {
  fs.copyFileSync(LLMS_FILE, path.join(PUBLIC_DIR, 'llms.txt'));
}

console.log(`[Update-Index] 成功重新构建索引！共收录 ${sops.length} 篇 SOP 资产。`);
console.log(`[SEO/GEO Build] 已生成 sitemap.xml, llms.txt, llms-full.txt, robots.txt。`);
