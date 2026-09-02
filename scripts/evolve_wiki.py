#!/usr/bin/env python3
"""
WikiSkill 演化提炼脚本 (本地/后台演化器)
功能：读取用户近期的改写被拒/手动修改记录 (Trace)，分析出新模式，并写入 wiki/patterns/。
"""
import os
import sys
import datetime

def append_pattern(pattern_file: str, new_rule: str, reason: str):
    if not os.path.exists(pattern_file):
        print(f"[-] 文件未找到: {pattern_file}")
        return
    
    timestamp = datetime.date.today().isoformat()
    entry = f"
- **[{timestamp} 演化新增]**: {new_rule} (归因: {reason})
"
    with open(pattern_file, "a", encoding="utf-8") as f:
        f.write(entry)
    print(f"[✔] 成功写入新规则到 {pattern_file}")

if __name__ == "__main__":
    print("[*] 模拟演化提炼：分析用户编辑历史并更新本地知识库...")
    # 示例规则
    append_pattern(
        "wiki/patterns/anti-patterns.md",
        "禁止在汇报中出现'基本上搞定'，统一优化为'核心功能已开发完成，正进行集成测试'。",
        "用户在昨日周报编写中对该句进行了手动替换"
    )
