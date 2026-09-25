# -*- coding: utf-8 -*-
"""64 卦三方一致性核对：05 文档 §3.2 速查表 / §3.5 词表 / 交付实现（packages/knowledge）

对拍对象是**交付实现**而非 UI 原型（代码审查 D-4）——原脚本读的是
`docs/ui/build/core.js`，于是「改了 packages/knowledge 却忘了同步原型」
不会被发现，而 README 却宣称它验证的是「文档 ↔ 实现」一致。

另新增 §2.2 类象类目与 `TRIGRAM_CATEGORIES` 的比对（D-5：
文档写 9 类、代码 10 类，按文档实现 Android 端会漏掉「五味」一列）。

运行：python .workbuddy/checks/kb-consistency.py
期望：全部一致、exit 0
"""
import io
import json
import os
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # .workbuddy/checks -> 仓根

DOC = os.path.join(ROOT, "docs", "dev", "05-卦象知识库设计.md")
LOADER = os.path.join(HERE, "load-delivery.cjs")

problems = []


def fail(msg):
    problems.append(msg)
    print("  FAIL " + msg)


def ok(msg):
    print("  ok   " + msg)


# ---------- 交付实现（经 esbuild 即时编译）----------

node = shutil.which("node") or shutil.which("node.exe")
if not node:
    print("找不到 node，无法读取交付实现。请把 node 加入 PATH 后重试。")
    sys.exit(2)

proc = subprocess.run(
    [node, LOADER], capture_output=True, encoding="utf-8", cwd=ROOT
)
if proc.returncode != 0:
    print("读取交付实现失败：")
    print(proc.stderr)
    sys.exit(2)

kb = json.loads(proc.stdout)
impl = {h["code"]: h for h in kb["hexagrams"]}
impl_names = {h["name"] for h in kb["hexagrams"]}
impl_kw = {h["name"]: h["keywords"] for h in kb["hexagrams"]}
impl_cats = [c["label"] for c in kb["categories"]]

print("交付实现 packages/knowledge：%d 卦 / %d 类目" % (len(impl), len(impl_cats)))

# ---------- 文档 ----------

md = io.open(DOC, encoding="utf-8").read()

# §3.2 速查表
tbl = md.split("### 3.2 六十四卦速查表")[1].split("此表同时作为")[0]
names32 = []
for line in tbl.strip().splitlines():
    if not line.startswith("|") or "---" in line or "上＼下" in line:
        continue
    cells = [c.strip() for c in line.strip("|").split("|")]
    names32.extend(cells[1:])

# §3.5 词表
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

# §2.2 类象总表表头（去掉「卦」「五行」两列）
t22 = md.split("### 2.2 八卦万物类象总表")[1].split("> 表头")[0]
cat_header = []
for line in t22.splitlines():
    if line.startswith("| 卦 | 五行 |"):
        cat_header = [c.strip() for c in line.strip("|").split("|")][2:]
        break

print(
    "文档 05：§3.2 表 %d 条 / §3.5 词表 %d 条 / §2.2 类目 %d 类"
    % (len(names32), len(kw), len(cat_header))
)

# ---------- ① §3.2 表 ↔ 交付实现 ----------

if len(names32) != 64 or len(set(names32)) != 64:
    fail("§3.2 速查表不是 64 条无重复（实际 %d 条 / 去重 %d）" % (len(names32), len(set(names32))))
else:
    ok("§3.2 速查表 64 条无重复")

miss_in_impl = sorted(set(names32) - impl_names)
miss_in_doc = sorted(impl_names - set(names32))
if miss_in_impl or miss_in_doc:
    fail("§3.2 表 ↔ 交付实现 卦名不一致：表有实现无 %s；实现有表无 %s" % (miss_in_impl, miss_in_doc))
else:
    ok("§3.2 表 64 卦名 ↔ 交付实现完全一致")

# ---------- ② §3.5 词表 ↔ 交付实现 ----------

bad_count = {n: len(v) for n, v in kw.items() if not (1 <= len(v) <= 5)}
if bad_count:
    fail("§3.5 词条数越界(1–5)：%s" % bad_count)
else:
    ok("§3.5 词条数均在 1–5（%d 条）" % len(kw))

diff = []
for n, k in kw.items():
    if n not in impl_kw:
        diff.append((n, "交付实现无此卦"))
    elif impl_kw[n] != k:
        diff.append((n, k, impl_kw[n]))
if diff:
    fail("§3.5 词表 ↔ 交付实现 不一致：\n" + json.dumps(diff, ensure_ascii=False, indent=1))
else:
    ok("§3.5 词表 ↔ 交付实现逐条一致")

# ---------- ③ §3.2 表 ↔ §3.5 词表（文档内部自洽）----------

only_tbl = sorted(set(names32) - set(kw))
only_kw = sorted(set(kw) - set(names32))
if only_tbl or only_kw:
    fail("§3.2 与 §3.5 卦名不一致：表有词表无 %s；词表有表无 %s" % (only_tbl, only_kw))
else:
    ok("§3.2 表 ↔ §3.5 词表 卦名一致")

# ---------- ④ §2.2 类象类目 ↔ TRIGRAM_CATEGORIES ----------

if not cat_header:
    fail("未能解析 05 §2.2 表头（找不到「| 卦 | 五行 |」开头的行）")
elif cat_header != impl_cats:
    fail(
        "§2.2 类目 ↔ TRIGRAM_CATEGORIES 不一致：\n  文档 = %s\n  实现 = %s"
        % (cat_header, impl_cats)
    )
else:
    ok("§2.2 类目 %d 类 ↔ TRIGRAM_CATEGORIES 逐列一致（名称与顺序）" % len(cat_header))

# ---------- 汇总 ----------

print()
if problems:
    print("==== %d 项不一致 ====" % len(problems))
    sys.exit(1)
print("==== 全部一致（64 卦三方 + 类目）====")
