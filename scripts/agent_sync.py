#!/usr/bin/env python3
"""
润笔 Agent 知识与技能同步器
功能：给入 GitHub Pages 根网址，自动拉取 manifest、wiki 与 active_skills，生成系统提示词。
"""
import urllib.request
import json
import sys

def fetch_url(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Runbi-Agent-Sync/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode("utf-8")

def sync_from_site(base_url: str):
    base_url = base_url.rstrip("/")
    manifest_url = f"{base_url}/manifest.json"
    print(f"[*] 正在拉取 Manifest: {manifest_url}")
    raw_manifest = fetch_url(manifest_url)
    manifest = json.loads(raw_manifest)

    wiki_content = []
    print(f"[*] 正在拉取 Wiki 知识库 ({len(manifest['wiki']['patterns'])} 个模式)...")
    for p in manifest["wiki"]["patterns"]:
        p_url = f"{base_url}/{p['file']}"
        content = fetch_url(p_url)
        wiki_content.append(f"### {p['title']} ({p['file']})
{content}
")

    skills_content = []
    print(f"[*] 正在拉取活跃技能 ({len(manifest['active_skills'])} 个技能)...")
    for sk in manifest["active_skills"]:
        s_url = f"{base_url}/{sk['file']}"
        content = fetch_url(s_url)
        skills_content.append(f"### 技能: {sk['title']} [{sk['id']}]
适用场景: {','.join(sk['target_scenarios'])}
{content}
")

    compiled_prompt = (
        "你当前已挂载【润笔自演进改写系统】。

"
        "==================== [WIKI 知识库 (长期持久)] ====================
"
        + "
".join(wiki_content) +
        "
==================== [SKILLS 技能库 (执行指令)] ====================
"
        + "
".join(skills_content) +
        "
=================================================================
"
        "收到改写任务时，请自动识别场景并遵照对应的 Skill 和 Wiki 规则执行改写。"
    )

    print("[✔] 成功拉取并编译 Agent System Prompt！")
    return compiled_prompt

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://dcn-autotest-team.github.io/runbi-updates"
    res = sync_from_site(url)
    print("
--- 生成的 System Prompt 预览 (前 500 字) ---")
    print(res[:500] + "...
")
