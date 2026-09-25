#!/usr/bin/env python3
"""把 docs/ui/build/{core.js,app.js} 重新内联进单文件原型 HTML。

原型是「单文件零依赖」交付物，源在 build/ 下。此前没有打包脚本，靠手工粘贴，
于是出现过「改了 build/core.js 但 HTML 里还是旧代码」的漂移（见代码审查报告
2026-09-25 的 D-1：原型闰月标签仍拼出「闰闰六月」）。

用法（仓库根目录）：
    python docs/ui/build/pack.py

改完 core.js / app.js / template.html 后必须跑一次，再跑 build/smoke.test.js 验证。
"""
from __future__ import annotations

import sys
from pathlib import Path

UI = Path(__file__).resolve().parents[1]
HTML = UI / "观梅-Plumora-UI设计稿.html"

# (源文件名, 该文件头注释里的一句话标识) —— 标识用于在 HTML 中定位已内联的块
MARKERS = [
    ("core.js", "观梅 · Plumora — 起卦核心算法"),
    ("app.js", "观梅 · Plumora — UI 控制层"),
]


def pack() -> int:
    if not HTML.exists():
        print(f"找不到原型文件：{HTML}", file=sys.stderr)
        return 1

    html = HTML.read_text(encoding="utf-8")
    for filename, marker in MARKERS:
        src_path = UI / "build" / filename
        src = src_path.read_text(encoding="utf-8")

        at = html.find(marker)
        if at < 0:
            print(f"HTML 中找不到 {filename} 的内联块（标记：{marker}）", file=sys.stderr)
            return 1
        open_tag = html.rfind("<script>", 0, at)
        close_tag = html.find("</script>", at)
        if open_tag < 0 or close_tag < 0:
            print(f"{filename} 的 <script> 边界不完整", file=sys.stderr)
            return 1

        html = (
            html[:open_tag]
            + "<script>" + src.rstrip("\n") + "\n</script>"
            + html[close_tag + len("</script>"):]
        )
        print(f"  内联 {filename:<9} {len(src.encode('utf-8')):>7} 字节")

    HTML.write_text(html, encoding="utf-8")
    print(f"已写回 {HTML.name}（{len(html.encode('utf-8'))} 字节）")
    return 0


if __name__ == "__main__":
    raise SystemExit(pack())
