# -*- coding: utf-8 -*-
"""文档集修订后自查：版本号一致性 / 旧值残留 / 表格列数 / 交叉引用"""
import io, os, re, glob, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = "D:/hxzhang/MyGithubSoftware/Plumora"

files = sorted(glob.glob(ROOT + "/docs/**/*.md", recursive=True))

# 变更日志行按 08 §五 规则 3 必须写明「原值 → 新值」，故会合法地出现旧值；
# 核查残留时须排除这些行，以及记录旧值作为证据的核查报告本身。
CHANGELOG_ROW = re.compile(r"^\|\s*v\d+\.\d+\s*\|")
DATE_ROW = re.compile(r"^\|\s*\d{4}-\d{2}-\d{2}\s*\|")
# 核查报告 / 校对流水本身就是「旧值的证据」：它们的表格用 **旧值** 而非「旧值」标注，
# 上面两条规则盖不住，故按文件名整体豁免（否则每轮核查都会自证有罪）。
EVIDENCE_FILE = re.compile(r"(review-\d{4}-\d{2}-\d{2}|CHANGELOG)\.md$")
def is_evidence(line, pat=None):
    """变更日志行 / 用「」引述旧值的更正说明 / 日期流水行 —— 均属合法出现旧值"""
    s = line.strip()
    if CHANGELOG_ROW.match(s) or DATE_ROW.match(s):
        return True
    if pat and ("「%s」" % pat) in line:
        return True
    return False

ok = bad = 0

print("=" * 78)
print("① 头部「文档版本」 vs 变更日志最高版本")
print("=" * 78)
for f in files:
    if f.endswith("CHANGELOG.md"):
        continue
    md = io.open(f, encoding="utf-8").read()
    rel = f.replace(ROOT + "/", "")
    m = re.search(r"\|\s*文档版本\s*\|\s*(v[\d.]+)", md)
    if not m:
        print("  --   %-58s 无「文档版本」字段" % rel)
        continue
    head = m.group(1)
    tail = ""
    for h in ("## 变更日志", "## 变更记录"):
        if h in md:
            tail = md.split(h)[-1]
            break
    vers = re.findall(r"\|\s*(v\d+\.\d+)\s*\|", tail)
    if not vers:
        print("  ??   %-58s 头部 %s，未找到变更日志" % (rel, head))
        continue
    def key(v):
        a, b = v.lstrip("v").split("."); return (int(a), int(b))
    top = max(vers, key=key)
    if head == top:
        ok += 1
        print("  ok   %-58s %s" % (rel, head))
    else:
        bad += 1
        print("  FAIL %-58s 头部 %s ≠ 日志最高 %s" % (rel, head, top))

print()
print("=" * 78)
print("② 旧值残留（应为 0 处，除非是合法卦名引用）")
print("=" * 78)
FORBIDDEN = [
    ("山水蹇", "卦名笔误，应为水山蹇"),
    ("水火未济", "卦名笔误，应为火水未济"),
    ("文档集版本", "已取消该字段"),
    ("见 NFR-03", "INTERNET 应引 NFR-02"),
    ("2–4 个", "keywords 条数已统一为 1–5"),
    ("05 文档 §3.1、§3.6", "应引 §3.5"),
]
for pat, why in FORBIDDEN:
    hits = []
    for f in files:
        if EVIDENCE_FILE.search(f):
            continue
        md = io.open(f, encoding="utf-8").read()
        for i, line in enumerate(md.splitlines(), 1):
            if pat in line and not is_evidence(line, pat):
                hits.append("%s:%d" % (f.replace(ROOT + "/", ""), i))
    if hits:
        bad += 1
        print("  FAIL 「%s」（%s）残留: %s" % (pat, why, ", ".join(hits)))
    else:
        ok += 1
        print("  ok   无残留：%s" % pat)

print()
print("=" * 78)
print("③ 「山水蒙」出现位置（应仅为合法卦名，不得出现在算例/用例/验收中）")
print("=" * 78)
LEGIT = ["05-卦象知识库设计.md", "手写笔记识读记录.md"]
for f in files:
    if EVIDENCE_FILE.search(f):
        continue
    md = io.open(f, encoding="utf-8").read()
    for i, line in enumerate(md.splitlines(), 1):
        if "山水蒙" in line and not is_evidence(line, "山水蒙"):
            rel = f.replace(ROOT + "/", "")
            tag = "（合法卦名）" if any(k in rel for k in LEGIT) else "**← 需人工确认**"
            print("  %s:%d %s %s" % (rel, i, tag, line.strip()[:88]))

print()
print("=" * 78)
print("④ Markdown 表格列数一致性")
print("=" * 78)
def ncell(line):
    # 按 GFM 规则：\| 是转义管道，不计为分隔符
    return len(re.sub(r"\\\|", "\x00", line.strip("|")).split("|"))
tbl_bad = 0
for f in files:
    md = io.open(f, encoding="utf-8").read()
    block = []
    for i, line in enumerate(md.splitlines(), 1):
        if line.strip().startswith("|"):
            block.append((i, line))
        else:
            if len(block) >= 2:
                widths = set(ncell(l) for _, l in block)
                if len(widths) > 1:
                    tbl_bad += 1
                    print("  FAIL %s:%d 起表格列数不一: %s" % (f.replace(ROOT + "/", ""), block[0][0], sorted(widths)))
            block = []
print("  表格列数异常块数:", tbl_bad)
if tbl_bad:
    bad += 1
else:
    ok += 1

print()
print("=" * 78)
print("⑤ 交叉引用「见 X 文档 §Y」的目标章节是否存在")
print("=" * 78)
DOCMAP = {
    "01": "01-产品需求文档PRD.md", "02": "02-系统架构设计.md", "03": "03-起卦核心算法设计.md",
    "04": "04-数据模型与存储设计.md", "05": "05-卦象知识库设计.md", "06": "06-UI-UX设计规范.md",
    "07": "07-测试计划.md", "08": "08-版本计划与发布规范.md", "09": "09-卦辞爻辞录入方案.md",
}
cache = {}
def secs(num):
    if num not in cache:
        p = ROOT + "/docs/dev/" + DOCMAP[num]
        cache[num] = io.open(p, encoding="utf-8").read()
    return cache[num]
xref_bad = 0
for f in files:
    md = io.open(f, encoding="utf-8").read()
    for i, line in enumerate(md.splitlines(), 1):
        if is_evidence(line):
            continue
        for m in re.finditer(r"(\d\d)\s*文档\s*(?:v[\d.]+\s*)?§([0-9.一二三四五六七八九十]+)", line):
            num, sec = m.groups()
            if num not in DOCMAP:
                continue
            body = secs(num)
            hit = ("§" + sec) in body or ("## " + sec) in body or ("### " + sec) in body
            if not hit:
                xref_bad += 1
                print("  FAIL %s:%d 引用 %s 文档 §%s —— 目标章节不存在" % (f.replace(ROOT + "/", ""), i, num, sec))
print("  失效交叉引用数:", xref_bad)
if xref_bad:
    bad += 1
else:
    ok += 1

print()
print("=" * 78)
print("汇总：%d 项通过，%d 项待处理" % (ok, bad))
print("=" * 78)
sys.exit(1 if bad else 0)
