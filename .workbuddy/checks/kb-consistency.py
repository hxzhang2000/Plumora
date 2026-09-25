# -*- coding: utf-8 -*-
"""核对 05 文档 §3.2 速查表 / §3.5 词表 与 core.js 实现是否一致"""
import re, io, json, sys
sys.stdout.reconfigure(encoding="utf-8")

P = "D:/hxzhang/MyGithubSoftware/Plumora/docs/dev/05-卦象知识库设计.md"
md = io.open(P, encoding="utf-8").read()

# --- §3.2 速查表 ---
tbl = md.split("### 3.2 六十四卦速查表")[1].split("此表同时作为")[0]
names32 = []
for line in tbl.strip().splitlines():
    if not line.startswith("|") or "---" in line or "上＼下" in line:
        continue
    cells = [c.strip() for c in line.strip("|").split("|")]
    names32.extend(cells[1:])
print("§3.2 速查表条目数:", len(names32), " 去重:", len(set(names32)))

# --- §3.5 词表 ---
t5 = md.split("### 3.5 六十四卦卦意关键词")[1].split("## 四、")[0]
kw = {}
for line in t5.splitlines():
    if not line.startswith("|") or "---" in line or "上卦宫" in line:
        continue
    body = line.strip("|").split("|")[1].strip()
    for item in body.split("；"):
        item = item.strip()
        if not item or "：" not in item:
            continue
        n, k = item.split("：", 1)
        kw[n.strip()] = [x.strip() for x in k.split("、") if x.strip()]
print("§3.5 词表条目数:", len(kw))
bad = {n: len(v) for n, v in kw.items() if not (1 <= len(v) <= 5)}
print("词条数越界(1-5):", bad or "无")

# --- 与 core.js 对照 ---
js = io.open("D:/hxzhang/MyGithubSoftware/Plumora/docs/ui/build/core.js", encoding="utf-8").read()
hex64 = {}
for m in re.finditer(r'"(\d)-(\d)":\s*\["([^"]+)",\s*"([^"]+)"\]', js):
    u, l, name, k = m.groups()
    hex64[u + "-" + l] = (name, [x.strip() for x in k.split("、")])
print("core.js 条目数:", len(hex64))

names_js = set(v[0] for v in hex64.values())
print("§3.2 表有但 core.js 无:", sorted(set(names32) - names_js))
print("core.js 有但 §3.2 表无:", sorted(names_js - set(names32)))

diff = []
for n, k in kw.items():
    hit = [v for v in hex64.values() if v[0] == n]
    if not hit:
        diff.append((n, "core.js 无此卦"))
    elif hit[0][1] != k:
        diff.append((n, k, hit[0][1]))
print("§3.5 词表与 core.js 不一致:", json.dumps(diff, ensure_ascii=False, indent=1))
