const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

const PORT = 3333;
const ROOT_DIR = path.resolve(__dirname);
const LIBRARY_DIR = path.join(ROOT_DIR, 'library');
const INDEX_FILE = path.join(ROOT_DIR, 'INDEX.md');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// 确保目录存在
const CATEGORIES = ['frontend', 'backend', 'ai-agent', 'automation', 'general'];
CATEGORIES.forEach(cat => {
  const p = path.join(LIBRARY_DIR, cat);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

function runGit(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: ROOT_DIR }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        error: err ? err.message : null
      });
    });
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// 扫描所有已有的 SOP
function scanSops() {
  const sops = [];
  CATEGORIES.forEach(cat => {
    const dir = path.join(LIBRARY_DIR, cat);
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      if (!file.endsWith('.md')) return;
      const fullPath = path.join(dir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // 提取标题和基本信息
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].replace(/^SOP:\s*/i, '').trim() : file;
      
      const techMatch = content.match(/\*\*核心(?:技术|栈)\*\*[:：]\s*(.+)$/m);
      const tech = techMatch ? techMatch[1].trim() : '通用规范';

      const painMatch = content.match(/\*\*解决痛点\*\*[:：]\s*(.+)$/m);
      const pain = painMatch ? painMatch[1].trim() : '标准化流程';

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
  return sops.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// 更新 INDEX.md
function updateIndexFile(sops) {
  const categoryNames = {
    'frontend': '🌐 前端与交互开发',
    'backend': '⚙️ 后端与服务端',
    'ai-agent': '🤖 AI 与 Agent 开发',
    'automation': '🕷️ 自动化与脚本',
    'general': '📦 综合与通用架构'
  };

  let md = `# 📚 SOP 知识资产总索引库 (Master Index)\n\n`;
  md += `> 本文件由 **SOP Hub** 自动同步维护。每次沉淀新项目时自动追加，需要查阅时自动检索。\n`;
  md += `> 状态：🟢 运行中 | 收录总数：${sops.length} 篇 | 最近同步时间：${new Date().toLocaleString()}\n\n`;
  md += `---\n\n## 快速检索导航\n\n`;
  md += `| 场景分类 | 目录路径 | 已收录资产数 |\n`;
  md += `| :--- | :--- | :--- |\n`;

  CATEGORIES.forEach(cat => {
    const count = sops.filter(s => s.category === cat).length;
    md += `| **${categoryNames[cat]}** | [\`library/${cat}/\`](./library/${cat}/) | ${count} |\n`;
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
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // API: 获取状态与 Git 状态
    if (pathname === '/api/status' && req.method === 'GET') {
      const gitRemote = await runGit('git remote -v');
      const gitBranch = await runGit('git branch --show-current');
      const gitStatus = await runGit('git status --porcelain');
      const gitUser = await runGit('git config user.name');
      const gitEmail = await runGit('git config user.email');

      return sendJson(res, 200, {
        port: PORT,
        hasRemote: gitRemote.stdout.length > 0,
        remoteUrl: gitRemote.stdout ? gitRemote.stdout.split('\n')[0].split('\t')[1]?.split(' ')[0] : '',
        currentBranch: gitBranch.stdout || 'main',
        hasUncommittedChanges: gitStatus.stdout.length > 0,
        uncommittedFiles: gitStatus.stdout ? gitStatus.stdout.split('\n').filter(Boolean) : [],
        gitUser: gitUser.stdout || '',
        gitEmail: gitEmail.stdout || ''
      });
    }

    // API: 获取所有 SOP 列表
    if (pathname === '/api/sops' && req.method === 'GET') {
      const list = scanSops();
      return sendJson(res, 200, { success: true, list });
    }

    // API: 新增/沉淀 SOP
    if (pathname === '/api/sops' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { title, category = 'general', tech = '', pain = '', rawContent } = body;

      if (!title || !rawContent) {
        return sendJson(res, 400, { success: false, message: '标题与内容不能为空' });
      }

      const validCategory = CATEGORIES.includes(category) ? category : 'general';
      const safeSlug = title.toLowerCase()
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || `sop-${Date.now()}`;

      const filename = `${safeSlug}.md`;
      const targetDir = path.join(LIBRARY_DIR, validCategory);
      const filePath = path.join(targetDir, filename);

      let markdownContent = rawContent.trim();
      // 如果内容不包含标准的 Markdown 头部，则自动包装
      if (!markdownContent.startsWith('# ')) {
        markdownContent = `# SOP: ${title}\n\n` +
          `> **分类**: ${validCategory}\n` +
          `> **核心技术**: ${tech || '未指定'}\n` +
          `> **解决痛点**: ${pain || '项目标准化与避坑'}\n` +
          `> **沉淀时间**: ${new Date().toLocaleDateString()}\n\n---\n\n` +
          markdownContent;
      }

      fs.writeFileSync(filePath, markdownContent, 'utf8');

      // 更新 INDEX.md
      const allSops = scanSops();
      updateIndexFile(allSops);

      return sendJson(res, 200, {
        success: true,
        message: '沉淀成功并已更新总索引',
        relPath: `library/${validCategory}/${filename}`
      });
    }

    // API: 配置 Git
    if (pathname === '/api/git/setup' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { username, email, remoteUrl } = body;

      if (username) await runGit(`git config user.name "${username}"`);
      if (email) await runGit(`git config user.email "${email}"`);
      if (remoteUrl) {
        // 先检查是否存在 origin
        const checkRemote = await runGit('git remote get-url origin');
        if (checkRemote.success) {
          await runGit(`git remote set-url origin "${remoteUrl}"`);
        } else {
          await runGit(`git remote add origin "${remoteUrl}"`);
        }
      }

      return sendJson(res, 200, { success: true, message: 'Git 配置已更新' });
    }

    // API: 一键提交并推送到 GitHub
    if (pathname === '/api/git/sync' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const commitMsg = body.message || `chore: auto-sync sop assets [${new Date().toLocaleString()}]`;

      // 确保当前有分支
      const branchRes = await runGit('git branch --show-current');
      let currentBranch = branchRes.stdout;
      if (!currentBranch) {
        await runGit('git branch -M main');
        currentBranch = 'main';
      }

      // 执行 git add .
      await runGit('git add .');

      // 执行 git commit
      const commitRes = await runGit(`git commit -m "${commitMsg}"`);

      // 执行 git push
      const pushRes = await runGit(`git push -u origin ${currentBranch}`);

      if (!pushRes.success) {
        return sendJson(res, 500, {
          success: false,
          message: '推送至 GitHub 失败，请检查网络或是否已在设置中正确配置远程仓库权限',
          detail: pushRes.stderr || pushRes.stdout || pushRes.error
        });
      }

      return sendJson(res, 200, {
        success: true,
        message: '成功推送到 GitHub 远程仓库！',
        stdout: pushRes.stdout
      });
    }

    // 静态文件服务
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8'
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      return res.end(fs.readFileSync(filePath));
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { success: false, message: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 SOP Hub 本地控制台已启动！`);
  console.log(`👉 访问地址: http://localhost:${PORT}`);
  console.log(`=========================================`);
});
