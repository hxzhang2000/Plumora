# 十翼原文展示 · UI/UX 设计规格

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v0.2（设计阶段：UI 规格 + 存储结构设计，未实施） |
| 编制日期 | 2026-09-26 |
| 文档状态 | **设计阶段**：无 `packages/*`、`apps/*` 任何代码落地；仅存 L1 层数据（原始 HTML/JSON，34 页 · 约 281KB），尚未结构化；本文档 v0.2 覆盖 **UI 设计（§1–§7, §9–§12）+ 存储结构设计（§8）** 两部分 |
| 关联文档 | `06-UI-UX设计规范.md` v3.0（唯一视觉权威源）、`05-卦象知识库设计.md` v2.0（现有知识库 3 数据集 + M1/M2/M3 录入计划，本文档 §8.5 讨论十翼作为第 4 数据集的关系）、`04-数据模型与存储设计.md` v1.9（两端存储口径与 assets/knowledge 组织）、`09-卦辞爻辞录入方案.md` v2.0（录入方法论与两轮人工校对）、`docs/dev/knowledge-review/design/卦级原文聚合展示-UI设计规格.md` v0.2（**姊妹设计**：卦级原文按卦分布，本文与之互补不冲突） |
| 视觉令牌 | 全部沿用 `apps/web/src/styles/tokens.css`（`--c-*` / `--fs-*` / `--sp-*` / `--r-*` / `--font-serif`）；不新增色板，不新增语义；仅在必要时补充少量「阅读视图」局部令牌（详见 §6） |
| 范围边界 | 本文档只覆盖「十翼五篇」的章级展示视图；**不涉及**卦级原文（归 GuaciYaoCiPanel）、**不涉及**数据解析器的具体实现细节（属后续实现文档）、**不修改** `06-UI-UX设计规范.md` 现有口径；如建议新增口径，交 orchestrator 统一协调 |
| 离线约束 | 纯静态前端，全部数据内联为 `generated/*.ts`（不引用外部 JSON/CDN/远程 API），符合 AGENTS.md「不发网络请求」硬承诺 |

---

## 一、设计目标与范围

### 1.1 内容现状（设计起点）

| 篇 | 页数 | 现有 Wikisource 页范围 | 内部章数（传统分） | 数据文件长度 |
| --- | --- | --- | --- | --- |
| 系辭上傳 | 12 | 07.01 – 07.12 | 12 章（「天尊地卑」至「聖人有以見天下之赜」） | 12 × 6–15 KB |
| 系辭下傳 | 9 | 08.1 – 08.9 | 9 章（对应 08.1–08.9） | 9 × 6–15 KB |
| 說卦傳 | 11 | 09.01 – 09.11 | 11 章（对应 09.01–09.11） | 11 × 2–10 KB |
| 序卦傳 | 1 | 10 | 1 篇（连续文本，不分章） | 17 KB |
| 雜卦傳 | 1 | 11 | 1 篇（连续文本，不分章） | 5 KB |
| **合计** | **34** | — | — | **约 281 KB** |

**关键结构观察**：

1. **来源是《周易正义》**（zh.wikisource.org/周易正義/{编号}）—— 孔颖达《周易正义》把**经文（十翼原文）**、**郑注/韩康伯注**、**孔颖达疏**三层文本混排。每一行可能同时含「经 + 注 + 疏」，如 `天尊地卑，乾坤定矣。乾坤其易之门户，先明天尊地卑，以定乾坤之体。` 前句是经、后句是注。
2. **五篇长度差异巨大**：系辭上 12 章最长，雜卦傳仅 5KB 单章 —— 需要**统一容器 + 差异化内容处理**。
3. **章与页不对齐**：系辭上的 12 章分布在 07.01–07.12，但并非一一对应（如 07.01 同时含第一章、第二章部分），需要**解析阶段把章切分边界标出**（详见 §7.2）。
4. **序卦傳、雜卦傳不分章**：只有单篇连续文本，导航结构上要**允许"一篇=一章"的退化情况**。

### 1.2 设计目标（三句话）

> **给五篇经典一个"翻经书"的阅读体验**：大号宋体、大留白、朱砂点睛；让读者在 34 页内容里能**一次进入、连续阅读、随时定位**，而非被"5 张卡片"或"34 页列表"割裂。
>
> **兼容两种数据形态**：L1 层未解析时给出「数据待校」占位；L2 结构化入库后自动切换到完整视图 —— UI 不因数据进度而返工。
>
> **与卦级原文聚合展示（GuaciYaoCiPanel）互补不重叠**：GuaciYaoCiPanel 展示**按卦分布**的原文（一卦六爻 + 卦辞 + 彖 + 大象 + 文言），本文档展示**按篇分布**的原文（5 篇 × 章 × 节）—— 两个视图共同覆盖《周易》的全部经典文本，读者可在两个视图间相互跳转。

### 1.3 目标用户

延续 06 文档「偏老年用户」的口径：

1. **可读性 > 视觉密度**：字号 ≥ 17px、行距 ≥ 2.0、正文不超 700px 宽 —— 视力衰退读者友好。
2. **单路径直达**：不做多层菜单堆叠，5 篇之间切换一步到位（顶栏 SegControl）。
3. **注释不喧宾夺主**：注疏默认折叠/弱化，不抢占经原文的视觉重量。
4. **零配置上手**：默认字号/布局/主题即"最好看的那一档"，不强迫用户先配置。

### 1.4 不做什么（非目标）

- **不做全文翻译/白话对照**（09 文档 §3.3 属 M2，不在 M1 范围）。
- **不做批注/画圈/高亮保存**（超出产品承诺，且需本地存储结构升级，见 §11）。
- **不做全文全文搜索**（依赖解析后索引，M2 项；M1 只保留搜索 UI 占位）。
- **不引入第三字体**：坚持 06 文档 §4.2 的「标题 Noto Serif SC + 正文 sans」体系；不做 CDATA 内联、不下载字体。
- **不修改 06 文档现有口径**：本文档只做增量设计，不重写任何 06 已有章节。

---

## 二、信息架构

### 2.1 入口位置

现有 06 文档 §2 定义了底部 3 Tab：起卦 / 卦例 / 学习。十翼作为**章级经典原文**，与「八卦类象」「六十四卦速查」同属"学习/参考"心智，放在**学习 Tab 的第三个分段视图**最自然，不引入新顶层入口。

**入口路径**：

```
起卦 ─┐
      ├── 学习 ── [SegControl: 八卦类象 | 六十四卦 | 十翼] ── 十翼总览 ── 单篇阅读
      │
      ├── 卦例 ── 卦例列表 ── 卦例详情 ── (未来) 卦辞卡"在《象传》中 →" 跨视图跳转
      │
      └── 设置 / 关于
```

**路由约定**：

- 学习页 Tab 三段：`#/learn?tab=xx` / `#/learn?tab=grid` / `#/learn?tab=shiYi`
- 十翼总览（进入阅读视图的跳板）：`#/learn?tab=shiYi` 的**默认状态**，展示 5 篇卡片
- 单篇阅读（进入某篇的正文）：`#/shi-yi/:slug`，slug 取英文短名（`xi-ci-upper` / `xi-ci-lower` / `shuo-gua` / `xu-gua` / `za-gua`）

**为什么单篇阅读要独立路由而非继续留在 `#/learn` 下**：

1. 阅读页是**长滚动 + 单篇沉浸**，与 SegControl 切换视图的心智冲突。
2. 独立路由便于"分享某篇某章"给同伴（`#/shi-yi/xi-ci-upper?ch=3`）。
3. 保持 `#/learn` 作为"三个并列速查块"的纯粹性，不承担长文阅读职能。
4. 与既有 `#/records/:id`（卦例详情）的路由形态保持一致 —— **都是详情路由**，从顶层列表点入、可分享。

### 2.2 视图层级

```
学习 Tab
├── SegControl（八卦类象 | 六十四卦 | 十翼）
└── 十翼视图（当 SegControl 选中"十翼"时）
    ├── 【十翼总览页】
    │   ├── 5 篇卡片网格（2×3 网格，最后一格是"阅读指南"或留白）
    │   ├── 卡片点击 → 进入单篇阅读
    │   └── 顶部「五篇一览」摘要（合计字数、合计章数、进度）
    │
    └── 【单篇阅读页】（新路由 /shi-yi/:slug）
        ├── 【顶栏】返回 + 篇名 + 字号档位 + 搜索 + 章目录抽屉
        ├── 【章节导引】章号 + 章题 + 章引（可选）+ 章末小注（可选）
        ├── 【正文】经原文按章段落排布
        ├── 【注疏层】（可选，M2 或开关态）缩进小字显示
        ├── 【页脚】上一节 / 下一节 + 阅读进度条
        └── 【键盘导航】←/→ 切章、Esc 返回列表、Ctrl+F 触发搜索
```

### 2.3 与 GuaciYaoCiPanel 的关系（姊妹设计）

| 维度 | GuaciYaoCiPanel（卦级原文聚合） | 十翼原文展示（本文档） |
| --- | --- | --- |
| 数据组织 | 按**卦**聚合（一卦的卦辞 + 6 爻爻辞 + 彖 + 大象 + 文言） | 按**篇**聚合（一篇的 12 或 9 或 1 章连续文本） |
| 触发位置 | 结果页「原文」tab、学习页 64 卦速查点击、（未来）卦详情 | 学习 Tab SegControl 第三档「十翼」、独立路由 `/shi-yi/:slug` |
| 视觉焦点 | 卦符 + 卦辞 + 爻辞；动爻高亮 | 经原文大字 + 章节导引；注疏次层 |
| 内容来源 | `packages/knowledge` 的 `Hexagram` interface | 未来 `packages/knowledge/src/shiYi.ts` 的 `SHIYI_TEXTS`（§8） |
| 交叉引用 | 无（单向：从卦展示原文） | 未来支持"从卦的《大象》→ 跳到《说卦传》对应章"（M2） |
| 是否已实施 | ✅ v0.2 已实施 | ❌ v0.1 仅设计 |

两者共同构成《周易》**原文展示的双视图体系**：GuaciYaoCiPanel 是「卦本位」的原文阅读器，十翼原文展示是「篇章本位」的原文阅读器，用户可根据阅读场景自由切换。

---

## 三、核心视图设计

### 3.1 十翼总览页（Overview）

**位置**：`#/learn?tab=shiYi` 默认落地页，用户点进"学习"→ SegControl 选"十翼"到达。

**目的**：让用户一眼看清 5 篇的整体面貌，快速选择要读的那一篇。

**布局**（wireframe）：

```
┌─────────────────────────────────────────────────┐
│ 观梅 · PLUMORA                                    │
│ [布局][真机框][扫码][设置]                         │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─SegControl──────────────────────────────┐    │
│  │  八卦类象  │  六十四卦  │  十  翼         │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌─十翼 · 五篇一览────────────────────────┐    │
│  │                                          │    │
│  │  《系辞上传》   《系辞下传》   《说卦传》  │    │
│  │   12 章 · 6.8 万字  9 章 · 5.2 万字  11 章│    │
│  │   "天尊地卑，乾坤定矣……"                │    │
│  │                                          │    │
│  │  《序卦传》     《杂卦传》                │    │
│  │   1 篇 · 1.7 万字  1 篇 · 0.5 万字       │    │
│  │                                          │    │
│  │  [开始阅读第一篇 →]                       │    │
│  │                                          │    │
│  │  阅读指南（可折叠）                        │    │
│  │    ▸ 如何读十翼 · 五篇结构说明 · 与卦的关系 │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
└─────────────────────────────────────────────────┘
```

**5 篇卡片布局**：

- **2 列网格**（桌面）：前 4 篇 2×2 排列，第 5 篇《杂卦傳》单独占一整行 —— 因为序卦傳、杂卦傳内容短，视觉重量也小。
- **单列**（移动）：5 张卡片竖排。
- 每张卡片包含：**篇名（宋体大字）** + **章数/字数统计（青灰小字）** + **章首引子前 30 字（灰字斜体引言）** + **朱砂角标"阅读 →"**。
- 卡片悬停：朱砂边框淡入（0.22s）；点击：整篇跳转。

**为什么不用"5 张卡等宽横排"**：5 个等宽卡片会挤得每张只有 200–250px 宽，无法展示章数/字数/引言的信息密度。改为 2×2+1 的**主 + 次**结构，四篇主要文献占主要位置，短小篇章单独一行，视觉重量与内容长度成正比。

### 3.2 单篇阅读页（Reader）

**位置**：`#/shi-yi/:slug`

**目的**：让用户在单页内连续读完某一篇，无需被章节切换打断。

**布局**（wireframe，桌面形态）：

```
┌────────────────────────────────────────────────────────┐
│  ← 学习    系辭上傳 · 第三章              [A-]  A+  [⋯] │
│  ─────────────────────────────────────────────  ──────│
├──────────┬───────────────────────────────────────────────┤
│ 章  目 录│    第三章                                     │
│          │    精气为物，游魂为变，是故明於天者                             │
│  ① 天尊… │    可以想其故矣                                       │
│  ② 圣人… │                                              │
│  ③ 彖者… │    明於天者，可以想其故矣。                     │
│  ④ 精气… │    明於地者，可以想其会矣。                     │
│  ⑤ 显诸… │                                              │
│  ⑥ 圣人… │    ——《系辞上传》第三章「精气为物」            │
│  ⑦ 初六… │                                              │
│  ⑧ 大衍… │    （注：精气，天地之始；游魂，神之所归……）   │
│  ⑨ 子曰… │    ↳ 展开完整注疏                                │
│  ⑩ 天…  │                                              │
│  ⑪ 是故… │                                              │
│  ⑫ 子曰… │                                              │
├──────────┴───────────────────────────────────────────────┤
│   ⌊ 阅读进度 ⌋  ●─●─●─●─●─○─○─○─○─○─○─○─○             │
│    ← 上一节   3 / 12   下一节 →                          │
└─────────────────────────────────────────────────────────┘
```

**布局**（wireframe，移动形态）：

```
┌───────────────┐
│ ← 学习  系辭上傳│  ← 顶栏第一行：返回 + 篇名（居左）
│ [字号][目录][⋯]│  ← 顶栏第二行：字号档位 + 章目录抽屉
├───────────────┤
│               │
│    第三章      │  ← 章号（居左对齐，朱砂圆点 + 序号）
│               │
│   彖者，言乎象者│
│    也；象者，  │
│  像也。        │
│               │
│   彖者，言乎  │  ← 正文（左对齐，非居中；居中在长文本下易读性差）
│    象者也……   │
│               │
├───────────────┤
│ ← 2 / 12 →    │  ← 页脚导航（底部 sticky）
└───────────────┘
```

**内容结构**（自上而下）：

| 元素 | 内容 | 视觉 | 交互 |
| --- | --- | --- | --- |
| **顶栏第一行** | `← 学习` + 篇名 | 48px 高，篇名宋体大字 | 返回 → `/learn?tab=shiYi` |
| **顶栏第二行** | 字号档位（-  默认  +）+ 章目录图标 + 更多（⋯） | 48px 高 | 字号 ±；目录开抽屉；更多含「展开注疏 / 深色模式 / 复制本章」 |
| **章导引区** | 章号（朱砂圆点 + 中文数字）+ 章题（可选） | 顶部居左，章号朱砂圈数字 | 无 |
| **章引**（可选） | 该章首句摘录 | 宋体引文样式，斜体灰字 | 无 |
| **正文** | 该章经原文，按原文的「。」句号断句分段 | 宋体大字 17–18px，行高 2.0，左对齐 | 长按复制；双击/双击选择段落 |
| **注疏层**（可选） | 该章对应的注/疏 | 青灰小字 13px，缩进 24px，左朱砂竖条 | 默认折叠；点击「展开」→ 展开 |
| **章末分隔** | 3 条短横线 ─ ─ ─ | 朱砂细线，居中 | 无 |
| **章末小注**（可选） | 该章的关键概念、与卦的关联 | 灰字小号，居中 | 未来可点跳卦详情（M2） |
| **页脚** | `← 上一节` + `X / N` + `下一节 →` | 底部 sticky，半透明浮层 | 键盘 ←/→ 等价；X/N 点击打开章目录 |

**为什么章号用「朱砂圆点 + 中文数字」**：

- 与 GuaciYaoCiPanel 的爻位角标「①②③④⑤⑥」（Unicode 圈号）呼应 —— **同一套符号语言**。
- 中文数字（一/二/三…）而非阿拉伯数字，符合「翻经书」的氛围。
- 朱砂圆点强化"这是重要节点"，与产品其他朱砂元素（动爻点、吉凶徽标）视觉一致。

**为什么正文左对齐而非居中**：

- 中文经典传统是竖排居中，但现代横排阅读的**最佳 F 型视线路径**是左对齐。
- 居中的长文本（>100 字/段）在宽屏上首字位置会左右晃动，眼睛每次找下一行都要重置起点。
- 左对齐 + 大字号 + 行高 2.0，是「阅读长文」的黄金参数。

---

## 四、字号与行距（长文阅读关键）

### 4.1 正文规格

| 项 | 值 | 备注 |
| --- | --- | --- |
| 正文字体 | `--font-serif`（Noto Serif SC 家族） | 与 06 §4.2 保持一致；经典原文用宋体是文化惯例 |
| 默认字号 | `clamp(17px, 4.4vw, 18px)` | 参考 GuaciYaoCiPanel `.gya-text`；略增一档以适配长文阅读 |
| 字号档位 | 15 / 16 / 17（默认） / 18 / 19 / 20 / 21 px | 7 档，间隔 1px；用户偏好存 `localStorage: plumora.shiYi.fontSize` |
| 行距 | `line-height: 2.0`（正文） / `1.5`（注疏） | 长文阅读的黄金区间是 1.6–2.2 |
| 字距 | `letter-spacing: 0.5px`（中文微调，与 GuaciYaoCiPanel 一致） | |
| 正文容器最大宽 | `min(720px, calc(100% - 32px))` | 32 字/行以下易读，超过 40 字/行视线疲劳 |
| 段间距 | `margin-block: 28px` | 比 GuaciYaoCiPanel 更宽（那是短段落） |

### 4.2 章导引规格

| 元素 | 规格 |
| --- | --- |
| 章号（朱砂圆点 + 中文数字） | `font: 500 15px/1 --font-sans`；朱砂圆点 8×8px 圆点，数字与圆点基线对齐 |
| 章题（可选，仅系辭上/说卦的每章首句作题） | `font: 600 18px/1.4 --font-serif`，与正文不同字重 |
| 章引（可选，摘引首句） | `font: italic 15px/1.6 --font-serif`，青灰色，`text-indent: 2em` |
| 章末小注 | `font: 13px/1.6 --font-sans`，青灰色，居中，前缀朱砂「─」 |

### 4.3 注疏层规格

| 元素 | 规格 |
| --- | --- |
| 注疏区缩进 | `padding-left: 24px`；左侧朱砂竖条 `border-left: 2px solid var(--c-accent-soft)` |
| 注疏字号 | `font: 400 13px/1.7 --font-sans`，青灰色（`--c-muted`） |
| 注疏默认状态 | **折叠**：显示前 30 字 + `…` + 「展开 ▾」按钮 |
| 展开态 | 全显示；点击「收起 ▴」返回折叠态 |
| 长注疏折叠阈值 | > 500 字时默认折叠；≤ 500 字时默认展开 |

**为什么注疏默认折叠**：

1. 用户点"十翼"是来读原文的，不是来读注疏的 —— 默认给原文完整视觉。
2. 注疏全文可能比原文长 3–5 倍（如 07.01 页注疏部分超过 5000 字），一次性展开会淹没原文。
3. 折叠态仍可见前 30 字作为"提示"，读者可以决定是否展开。

---

## 五、色彩与视觉

### 5.1 色板映射（全部沿用 tokens.css，不新增语义）

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--c-bg` | #FAF7F0 | 阅读页背景（与全局一致，不特别加深） |
| `--c-surface` | #FFFFFF | 章导引区背景（可选卡片化） |
| `--c-text` | #2B2B2B | 正文经原文 |
| `--c-ink` | #3A3A3A | 章号数字 |
| `--c-accent` | #B03A2E | 章号朱砂圆点、章末分隔线、字号档位按钮 hover |
| `--c-accent-soft` | rgba(176,58,46,0.08) | 注疏区左侧竖条 |
| `--c-muted` | #8A8578 | 注疏文字、章末小注、字数统计 |
| `--c-line` | #E8E2D5 | 段间虚线分隔、页脚边框 |
| `--c-scrim` | rgba(30,26,20,0.45) | 章目录抽屉遮罩 |

**深色模式**（`data-theme="dark"`）：全部沿用 tokens.css 深色值，无新增。

### 5.2 视觉细节

| 细节 | 方案 | 意图 |
| --- | --- | --- |
| **章末分隔** | 三条短横线居中，间距 8px，朱砂色，`opacity: 0.4` | 呼应"经义"传统（章末以横线或墨点分隔） |
| **章号圈数字** | Unicode 圈号 ①②③… 与 GuaciYaoCiPanel 的爻位角标同款 | 保持**跨视图符号语言一致** |
| **注疏展开按钮** | 朱砂边框小药丸「展开 ▾」，16px 高 | 明确可交互；朱砂引导视线 |
| **阅读进度条** | 页脚上方 4px 高的细条，朱砂填充按已读比例推进 | 视觉锚点 |
| **返回按钮** | 无背景图标按钮（`icon-btn` 样式）+ 「学习」二字 | 与 App.vue 现有按钮形态一致 |
| **顶栏第二行** | 与 App.vue 顶栏第二行**同结构**（操作钮右对齐） | 视觉连续性 |
| **卡片朱砂角标** | 「阅读 →」朱砂小圆角标签，右下贴边 | 引导点击 |

### 5.3 与 06 文档「安静的水墨气质」原则的对齐

| 06 §一 原则 | 本文档如何体现 |
| --- | --- |
| 宣纸、墨线、朱砂点 | 全部沿用 tokens.css，无新增色板 |
| 克制的留白，不堆砌装饰 | 章末分隔仅三条横线，不加花纹；正文书面化而非装饰化 |
| 排盘即核心 | 十翼页无卦符，主视觉是文字本身（这与排盘页不同，不冲突） |
| 规则陈述而非断言 | 本文档不涉及断卦表述；注疏原文照录，不做应用内解释 |
| 单手可达 | 移动顶栏按钮均在拇指热区（顶栏第二行居中偏右）；页脚翻页按钮在拇指热区 |
| 一套令牌两端渲染 | 全部走 tokens.css，无新令牌 |

---

## 六、动效与交互细节

### 6.1 动效（全部尊重 `prefers-reduced-motion`）

| 场景 | 动效 | 时长 |
| --- | --- | --- |
| 从总览进入阅读页 | 无（避免切换干扰阅读） | — |
| 字号档位切换 | 字号 `transition: font-size 0.18s ease` | 180ms |
| 注疏展开/折叠 | `grid-template-rows: 0fr → 1fr` + opacity | 220ms（与 GuaciYaoCiPanel 一致） |
| 章目录抽屉打开 | `translateX(100%) → 0` + scrim 淡入 | 240ms |
| 章节翻页（←/→） | 内容水平滑入 `translateX(20%) → 0` + 淡入 | 260ms |
| 字号 + / - 按钮 | 按下 `transform: scale(0.92)`，松开恢复 | 120ms |
| 阅读进度条推进 | 无动画（跟随 scroll 实时） | — |

### 6.2 键盘导航

| 键 | 作用 |
| --- | --- |
| `←` / `→` | 上一节 / 下一节（在章之间切换；若在第一章按 `←`，跳到上一篇的最后一章） |
| `Esc` | 从阅读页返回列表（若抽屉开着，先关抽屉） |
| `Home` / `End` | 跳到本文最上 / 最下（浏览器默认行为） |
| `Ctrl+F` | 触发搜索（M2，依赖索引就绪；M1 阶段提示"全文搜索将于数据校完后开放"） |
| `Tab` | 搜索命中结果间循环跳转（M2） |
| `Space` | 翻页（下） / Shift+Space（上）—— 浏览器默认滚动，无需覆盖 |

**键盘可访问性**：所有按钮、链接、可展开区域均有可见焦点样式（朱砂 outline，2px，offset 2px）；页面无键盘陷阱。

### 6.3 触屏交互

| 手势 | 作用 |
| --- | --- |
| 从右边缘向左滑 | 打开章目录抽屉 |
| 从章目录抽屉向左滑 | 关闭抽屉 |
| 长按正文 | 系统原生文本选择（浏览器内置） |
| 双击正文 | 选中当前段（Safari / Chrome 内置） |
| 双指捏合 | 无（字号档位由顶栏按钮控制，不用 pinch zoom 避免与浏览器缩放冲突） |

### 6.4 阅读进度记录

- 存储键：`localStorage: plumora.shiYi.progress.${slug}` = `{ ch: number, ratio: number, at: number }`
- `ch`：当前章序号（1-based）；`ratio`：章内阅读比例 0–1；`at`：时间戳（ms）
- 采集方式：`IntersectionObserver` 监听每个 `<p>` 段落与视口的相交比例，每 500ms 计算一次
- 用途：
  1. 阅读页页脚的「3 / 12」显示当前章
  2. 总览页卡片上显示「已读至第 X 章」（未来，M2）
  3. 未来"继续阅读"入口（M3，不在本文档范围）

---

## 七、无障碍

| 项 | 要求 |
| --- | --- |
| **语义化结构** | `<article class="shi-yi">` 包裹整页；`<header>` 章导引；`<section aria-labelledby="ch-1">` 每章；`<aside>` 注疏层 |
| **ARIA 标签** | 章目录抽屉 `role="navigation" aria-label="章节目录"`；注疏折叠区 `aria-expanded` / `aria-controls`；字号档位按钮 `aria-label="字号：中"` |
| **正文可读性** | 屏幕阅读器朗读正文时按"经原文"、注疏时按"注：「…」"标注（通过 `aria-label` 或 `role="note"`） |
| **焦点管理** | 打开章目录后焦点入抽屉首项；关闭后焦点回到触发按钮；字号档位按钮组内可用 `←/→` 循环 |
| **触屏目标** | 全部可点元素 `min-width/min-height: 48px`（`--tap-min`），与 06 §6.1 一致 |
| **动效降级** | `prefers-reduced-motion: reduce` 时全部动效禁用（tokens.css 已全局处理） |
| **字体缩放** | 支持浏览器/系统 1.0–1.3 字体缩放不破版 —— 正文用 `clamp()` 与相对单位，不用固定 px |
| **对比度** | 正文 #2B2B2B 在 #FAF7F0 上对比度 12.3:1（远超 WCAG AA 4.5:1）；注疏 #8A8578 在 #FAF7F0 上 3.4:1（**低于 AA，仅对小字注疏可用**；若需满足 AA，注疏色应改为 #706B60 左右，交 orchestrator 决策） |

---
## 八、存储与数据结构设计

本节从 UI 设计深入到存储层：定义文件组织、TypeScript 接口、数据编码、与现有知识库的集成方式，以及从 L1 原始数据到 L2 结构化数据的解析管线。设计目标是**与现有 knowledge 包平行的第 4 个数据集**，遵循同样的纯数据、平台无关、离线可用原则。

### 8.1 设计原则

| 原则 | 说明 |
| --- | --- |
| **纯数据、零依赖** | 与 `hexagrams.ts` / `trigrams.ts` / `strokes.ts` 平行，不引入任何依赖（`packages/knowledge` 声明为零依赖） |
| **`readonly` 契约** | 所有导出类型与常量均为 `readonly`，接口字段全 `readonly`，防止运行时意外修改 |
| **数据与逻辑分离** | 大表放 `shiYi.generated.ts`，类型与函数放 `shiYi.ts` —— 沿用 `strokes.generated.ts` + `strokes-overrides.ts` + `strokes.ts` 的三段式模式 |
| **繁体权威 + 简体交付** | 与 hexagrams 一致，主数据存 zh-hant 权威层，交付时按需转简体（05 §3.3 M1 阶段 hexagrams 即繁体存储） |
| **稳定 chapter ID** | 不依赖数组下标，采用 `slug:chapterIndex` 复合键（如 `xi-ci-upper:1`），便于跨版本引用与未来扩展 |
| **不侵入 05 文档** | 本文档不修改 05 现有口径；是否将十翼作为 05 第 4 个数据集正式收录，交 orchestrator 决策（见 §12 Q8） |

### 8.2 文件组织方案

| 文件 | 内容 | 预计大小 | 说明 |
| --- | --- | --- | --- |
| `packages/knowledge/src/shiYi.ts` | 类型接口、辅助函数、`validateShiyiData()` | ~12KB / ~400 行 | 主入口，类似 `hexagrams.ts` |
| `packages/knowledge/src/shiYi.generated.ts` | 5 篇的 RAW 数据常量 | ~50–70KB | 自动生成 / 校对后固化，类似 `strokes.generated.ts` |
| `packages/knowledge/src/index.ts` | 追加 4 行导出 | 现有 38 行 → 42 行 | 一行改动 |
| `packages/knowledge/test/shiYi.test.ts` | 结构校验 + 章节完整性 + 金标准 | ~5KB / ~150 行 | 与 `knowledge.test.ts` 平行 |

**文件命名一致性**：现有 `hexagrams.ts` / `trigrams.ts` / `strokes.ts` 均为驼峰式；本文档建议 `shiYi.ts`（驼峰，`shiYi` 而非 `shi-yi`），与 URL slug `shi-yi` 区分（URL 用 kebab-case、代码用 camelCase，各遵循各的约定）。若团队习惯全 kebab-case，可改 `shi-yi.ts`（需 orchestrator 决策）。

**不放在 `apps/knowledge/` 或 `apps/web/src/` 的原因**：

1. 数据是**平台无关纯数据**，未来 Android 端可直接复用（04 文档 §一 assets/knowledge/*.json）。
2. `packages/knowledge` 是编译进产物的知识库包，27,584 字（202KB）笔画映射就在这里；十翼同规模（280KB raw → 60KB 结构化后），放在同一包最合理。
3. 与 hexagrams 的原文数据在同一包里，便于校验一致性（如「坎」在 hexagrams 卦名和说卦传中都出现）。
4. 平台无关性可支撑后续 PWA / Electron / Node CLI 等多端扩展。

**索引导出**（`packages/knowledge/src/index.ts` 追加）：

```typescript
export {
  SHIYI_TEXTS,
  getShiyiText,
  getShiyiChapter,
  allShiyiParagraphs,
  validateShiyiData,
} from './shiYi.js';
export type {
  ShiyiSlug,
  ShiyiChapterId,
  ShiyiParagraphId,
  ShiyiText,
  ShiyiChapter,
  ShiyiParagraph,
  ShiyiAnnotation,
  ShiyiAnnotationKind,
  ShiyiParagraphKind,
  ShiyiIssue,
} from './shiYi.js';
```

### 8.3 TypeScript 接口定义（完整）

```typescript
/* ============================================================
 * 十翼文本结构化数据 —— 对应本设计规格 §8
 *
 * 与 packages/knowledge/src/hexagrams.ts 的 Hexagram interface 平行：
 *   hexagrams.ts  =  按卦聚合的原文（64 卦 × 6 爻）
 *   shiYi.ts      =  按篇聚合的原文（5 篇 × 12/9/11/1/1 章）
 *
 * 数据源：《周易正義》维基文库 zh.wikisource.org/周易正義/{编号}
 *        （孔颖达《周易正义》本，经 + 郑注/韩康伯注 + 孔疏三层）
 *
 * 存储口径：主数据存 zh-hant（繁体权威层），交付层按需转简体
 * ============================================================ */

/** 五篇短名（URL slug，与 shiYi.generated.ts 中的 RAW 键一致） */
export type ShiyiSlug =
  | 'xi-ci-upper'   // 系辭上傳
  | 'xi-ci-lower'   // 系辭下傳
  | 'shuo-gua'      // 说卦傳
  | 'xu-gua'        // 序卦傳
  | 'za-gua';       // 杂卦傳

/** 章 ID：`slug:chapterIndex`，如 `xi-ci-upper:1`（稳定键，不依赖下标） */
export type ShiyiChapterId = `${ShiyiSlug}:${number}`;

/** 段 ID：`chapterId:paragraphIndex`，如 `xi-ci-upper:1:1` */
export type ShiyiParagraphId = `${ShiyiChapterId}:${number}`;

/**
 * 段种类：
 * - `body`     ：章内正文段落（默认）
 * - `quote`    ：引例段落（如"若《剥》之六五黄裳元吉"这类引他卦例的段落）
 * - `preamble` ：篇首或章首的前言说明段（如系辭上传篇首的序言）
 *
 * 目前解析器默认所有段落 kind = 'body'，其他两种需人工校对时标注。
 */
export type ShiyiParagraphKind = 'body' | 'quote' | 'preamble';

/**
 * 注疏类型：
 * - `zhu` ：郑玄注 / 韩康伯注（十翼原文的历代注文）
 * - `shu` ：孔颖达疏（唐代孔颖达《周易正义》疏，Wikisource 页面中带 `[疏]` 前缀）
 *
 * 注疏是**可选层**：M1 只交付 jing（经），M2 才接 zhu/shu。
 */
export type ShiyiAnnotationKind = 'zhu' | 'shu';

/** 段内嵌的注疏（对应某一独立段落） */
export interface ShiyiAnnotation {
  readonly kind: ShiyiAnnotationKind;
  /** 注疏作者名（如"郑玄""韩康伯""孔颖达"） */
  readonly author: string;
  /** 注疏正文（不含"正义曰：""注曰"等前缀） */
  readonly text: string;
  /** 注疏原文起始字节偏移（可选，用于溯源校对，不进 UI） */
  readonly sourceOffset?: number;
}

/**
 * 段落：十翼经原文的最小单元。
 * 一个段落对应原文中的一个「。」「！」「？」句号断句块。
 */
export interface ShiyiParagraph {
  /** 段序号（章内 1-based，1..N） */
  readonly index: number;
  /** 段 ID（章 ID + 段序号拼接） */
  readonly id: ShiyiParagraphId;
  /** 段文本（zh-hant 权威层） */
  readonly text: string;
  /** 段文本（zh-hans 交付层，可选） */
  readonly textHans?: string;
  /** 段种类 */
  readonly kind: ShiyiParagraphKind;
  /** 段关联的注疏（该段独有的注疏；章级共用注疏不放这里） */
  readonly annotations?: readonly ShiyiAnnotation[];
}

/**
 * 章：十翼的最小阅读单元。
 * 系辭上 12 章 / 系辭下 9 章 / 说卦 11 章 / 序卦 1 章 / 杂卦 1 章。
 */
export interface ShiyiChapter {
  /** 章序号（篇内 1-based） */
  readonly index: number;
  /** 章 ID（slug:chapterIndex） */
  readonly id: ShiyiChapterId;
  /** 章题（如「天尊地卑」「圣人设卦」），序卦/杂卦无章题时可缺省 */
  readonly title?: string;
  /** 章引（章首 20–40 字摘录，用于卡片引言和搜索摘要） */
  readonly quote?: string;
  /** 章末小注（可选，如关键概念、与卦的关联） */
  readonly note?: string;
  /** 章内段落（按原顺序） */
  readonly paragraphs: readonly ShiyiParagraph[];
  /** 章级共用注疏（跨段落共用，如章首/章末的整体注疏） */
  readonly annotations?: readonly ShiyiAnnotation[];
}

/**
 * 篇：五翼之一。
 *
 * ⚠️ 命名区分：「翼」是十翼的统称（Ten Wings），「篇」是本次收录的五个具体
 * 篇章。为避免术语混淆，字段一律用"篇"而非"翼"。
 */
export interface ShiyiText {
  readonly slug: ShiyiSlug;
  readonly name: string;               // 系辞上传
  readonly nameTraditional: string;    // 系辭上傳 —— 顶部大标题展示
  readonly nameEnglish: string;        // Great Commentary (Upper) —— aria-label
  /** 篇首摘要（30 字以内，用于总览卡片） */
  readonly summary: string;
  readonly chapterCount: number;
  /** 全文总字数（不含标点，繁字口径） */
  readonly totalChars: number;
  readonly chapters: readonly ShiyiChapter[];
  /** 数据源信息（用于版权、校对与溯源） */
  readonly source: {
    readonly wikisourceUrl: string;
    /** 该篇的所有 Wikisource 页编号（如 `['07.01', '07.02', ..., '07.12']`） */
    readonly pageIds: readonly string[];
    /** 每页对应的 oldid（页面修订版本，用于溯源校对；解析时固化，不随 Wikisource 变化） */
    readonly oldids: readonly string[];
    readonly lang: 'zh-hant';
    readonly langHans: 'zh-hans';
  };
}

/** 校验问题类型（validateShiyiData 返回值） */
export interface ShiyiIssue {
  readonly level: 'error' | 'warn';
  readonly message: string;
  readonly slug?: ShiyiSlug;
  readonly chapterIndex?: number;
  readonly paragraphIndex?: number;
}

/** 5 篇索引（顶层导出，供组件直接消费） */
export const SHIYI_TEXTS: readonly ShiyiText[] = [
  // ...5 篇数据（来自 shiYi.generated.ts 的 RAW 常量）...
];

/** 按 slug 查单篇（组件消费入口） */
export function getShiyiText(slug: ShiyiSlug): ShiyiText | undefined;

/** 按章 ID 查单章（跨篇检索入口） */
export function getShiyiChapter(chapterId: ShiyiChapterId): ShiyiChapter | undefined;

/**
 * 迭代全部段落（供全文搜索索引使用，M2）。
 * 生成器函数：`for (const p of allShiyiParagraphs()) { ... }`
 */
export function* allShiyiParagraphs(): Generator<ShiyiParagraph>;

/**
 * 校验数据完整性（类似 hexagrams.ts 的 validateKnowledgeBase）。
 * 检查：
 * 1. 5 篇齐全，slug 唯一
 * 2. 每篇 chapterCount 与 chapters.length 一致
 * 3. 每章 index 从 1 开始连续
 * 4. 每段 index 从 1 开始连续
 * 5. totalChars 与实际字符数一致
 * 6. source.oldids.length 与 source.pageIds.length 一致
 */
export function validateShiyiData(): readonly ShiyiIssue[];
```

### 8.4 数据组织策略（`shiYi.generated.ts`）

沿用 `hexagrams.ts:99` 的 `RAW` 常量模式，把大表放 `shiYi.generated.ts`（**元组紧凑格式**，与 `RAW_TEXT: [string, HexagramLine[], string | null]` 的三元组风格一致）：

```typescript
// packages/knowledge/src/shiYi.generated.ts
/* ============================================================
 * 十翼 5 篇原始数据 —— 校对后固化，请勿手工编辑
 *
 * 变更流程：修改源解析脚本（未来 scripts/shiyi-parse.js）
 *          → 重跑解析 → 生成新 L2 JSON → 与旧版 diff → 人工确认 → 提交
 *
 * 文件由 .workbuddy/checks/shiYi-consistency.py 校验与 L2 JSON 一致。
 * ============================================================ */

import type { ShiyiSlug } from './shiYi.js';

/** 元组格式：[index, title?, quote?, note?, paragraphs] */
type RawChapter = readonly [
  index: number,
  title: string | null,
  quote: string | null,
  note: string | null,
  paragraphs: readonly (readonly [
    text: string,
    kind: 'body' | 'quote' | 'preamble',
    annotations: readonly (readonly ['zhu' | 'shu', string, string])[]
  ])[]
];

/** 元组格式：[slug, name, nameTraditional, nameEnglish, summary, pageIds, oldids, chapters] */
type RawText = readonly [
  ShiyiSlug,
  string,           // name
  string,           // nameTraditional
  string,           // nameEnglish
  string,           // summary
  readonly string[], // pageIds
  readonly string[], // oldids
  RawChapter[]
];

/** 5 篇原始表（键 = slug） */
export const RAW_SHIYI: Readonly<Record<ShiyiSlug, RawText>> = {
  'xi-ci-upper': [
    'xi-ci-upper', '系辞上传', '系辭上傳', 'Great Commentary (Upper)',
    '天尊地卑，乾坤定矣……明於天者可以想其故矣。',
    ['07.01', '07.02', /* ... */, '07.12'],
    ['2415389', '2415415', /* ... */],
    [
      // 第一章：天尊地卑
      [1, '天尊地卑', '天尊地卑，乾坤定矣……明於天者可以想其故矣。', null,
        [
          ['天尊地卑，乾坤定矣。', 'body', [['shu', '孔颖达', '……']]],
          ['剛柔相摩，八卦相盪。', 'body', []],
          /* ... */
        ]
      ],
      // 第二章：圣人设卦……
    ],
  ],
  /* 'xi-ci-lower', 'shuo-gua', 'xu-gua', 'za-gua' 结构类似 */
};
```

**在 `shiYi.ts` 中转换为 ShiyiText**（示例，实际实现会稍长）：

```typescript
// packages/knowledge/src/shiYi.ts
import { RAW_SHIYI } from './shiYi.generated.js';

const slugList: readonly ShiyiSlug[] = [
  'xi-ci-upper', 'xi-ci-lower', 'shuo-gua', 'xu-gua', 'za-gua',
] as const;

function buildParagraphs(
  slug: ShiyiSlug,
  chapterIndex: number,
  rawParagraphs: RawText['7']['2']  /* 从 RawText 元组取 chapters[i][4] 段落 */
): ShiyiParagraph[] {
  return rawParagraphs.map(([text, kind, anns], pi) => ({
    index: pi + 1,
    id: `${slug}:${chapterIndex}:${pi + 1}` as ShiyiParagraphId,
    text,
    kind,
    annotations: anns.length
      ? anns.map(([kind, author, text]) => ({ kind, author, text }))
      : undefined,
  }));
}

export const SHIYI_TEXTS: readonly ShiyiText[] = slugList.map((slug) => {
  const [, name, nameTraditional, nameEnglish, summary, pageIds, oldids, chapters] = RAW_SHIYI[slug];
  const builtChapters = chapters.map(([i, title, quote, note, paragraphs]) => ({
    index: i,
    id: `${slug}:${i}` as ShiyiChapterId,
    title: title ?? undefined,
    quote: quote ?? undefined,
    note: note ?? undefined,
    paragraphs: buildParagraphs(slug, i, paragraphs),
  }));
  const totalChars = builtChapters.reduce((acc, ch) =>
    acc + ch.paragraphs.reduce((s, p) => s + countCjk(p.text), 0), 0);
  return {
    slug, name, nameTraditional, nameEnglish, summary,
    chapterCount: builtChapters.length,
    totalChars,
    chapters: builtChapters,
    source: {
      wikisourceUrl: 'https://zh.wikisource.org/周易正義/',
      pageIds, oldids,
      lang: 'zh-hant', langHans: 'zh-hans',
    },
  };
});

export function getShiyiText(slug: ShiyiSlug): ShiyiText | undefined {
  return SHIYI_TEXTS.find(t => t.slug === slug);
}

export function getShiyiChapter(chapterId: ShiyiChapterId): ShiyiChapter | undefined {
  const [slug, indexStr] = chapterId.split(':');
  const text = getShiyiText(slug as ShiyiSlug);
  return text?.chapters.find(c => c.index === parseInt(indexStr));
}

export function* allShiyiParagraphs(): Generator<ShiyiParagraph> {
  for (const text of SHIYI_TEXTS) {
    for (const chapter of text.chapters) {
      yield* chapter.paragraphs;
    }
  }
}

export function validateShiyiData(): readonly ShiyiIssue[] {
  const issues: ShiyiIssue[] = [];
  if (SHIYI_TEXTS.length !== 5) {
    issues.push({ level: 'error', message: `SHIYI_TEXTS should have 5 entries, got ${SHIYI_TEXTS.length}` });
  }
  const seenSlugs = new Set<ShiyiSlug>();
  for (const text of SHIYI_TEXTS) {
    if (seenSlugs.has(text.slug)) issues.push({ level: 'error', slug: text.slug, message: 'duplicate slug' });
    seenSlugs.add(text.slug);
    if (text.chapters.length !== text.chapterCount) {
      issues.push({ level: 'error', slug: text.slug, message: `chapterCount mismatch: ${text.chapterCount} declared, ${text.chapters.length} actual` });
    }
    for (const ch of text.chapters) {
      if (ch.index !== ch.paragraphs.length ? /* 检查连续递增 */ 0 : 1) {
        issues.push({ level: 'error', slug: text.slug, chapterIndex: ch.index, message: 'chapter index not consecutive' });
      }
      for (const p of ch.paragraphs) {
        if (!p.text.trim()) issues.push({ level: 'warn', slug: text.slug, chapterIndex: ch.index, paragraphIndex: p.index, message: 'empty paragraph' });
      }
    }
    if (text.source.pageIds.length !== text.source.oldids.length) {
      issues.push({ level: 'error', slug: text.slug, message: 'pageIds/oldids length mismatch' });
    }
  }
  return issues;
}
```

**预计文件体积**：
- `shiYi.generated.ts`：约 50–70KB（5 篇共 ~17 万字 → 元组压缩后）
- `shiYi.ts`：约 8–12KB（接口 + 转换 + 校验 + 辅助函数）
- 合计约 60–80KB，与现有 `strokes.generated.ts`（202KB）相比仍显著更小

### 8.5 与现有知识库的集成方式

**05 文档 §一 知识库构成表**当前列 3 个数据集。加入十翼后需追加一行（未来 05 v2.1 时）：

| 数据集 | 条目数 | 内容 | 文件 |
| --- | --- | --- | --- |
| 八卦基础 | 8 | 卦符、数、五行、类象 | trigrams.ts |
| 六十四卦 | 64 | 卦名、上下卦、卦意关键词、卦辞、六爻爻辞 | hexagrams.ts |
| 汉字笔画映射 | 27,584 字 | 字 → 笔画（`s` 简体 / `t` 繁体，单表双标准） | strokes.generated.ts + strokes-overrides.ts + strokes.ts |
| **十翼原文**（新增） | 5 篇 / 34 页 / ~17 万字 | 系辭上傳 12 章 / 系辭下傳 9 章 / 说卦傳 11 章 / 序卦傳 1 章 / 杂卦傳 1 章 | shiYi.generated.ts + shiYi.ts |

**是否修改 05 文档 v2.0**（3 种策略）：

- **A（推荐）**：05 升 v2.1，追加十翼一行；十翼与 hexagrams/trigrams/strokes 平级。
- **B**：05 文档不改，十翼归属独立设计文档（本文档）管辖，作为"内容扩展"而非"知识库数据集"。
- **C**：05 文档 §3.3 追加 M4 阶段项（M4 = 十翼录入），本次不升版本号。

交 orchestrator 决策（见 §12 Q8）。

**与 hexagrams 的交叉引用**（未来 M3）：

- 卦辞 → 说卦传/序卦传/杂卦传的相关段落（如"坎" ↔ 说卦传「坎为水，为沟渎，为隐伏」）。
- 交叉引用实现有 3 种方案：
  - **方案 1**：在 `ShiyiText` 里增加 `relatedHexagrams?: readonly HexCode[]`（同包内引用，最简单）
  - **方案 2**：独立文件 `shiYiCrossRef.ts`（分离关系统计表，便于独立校对）
  - **方案 3**：运行时通过 keyword 全文搜索（无静态映射，最灵活但性能差）
- 本文档不锁定方案，交未来 M3 决策（见 §12 Q5）。

**Android 端后续**（04 文档 §一）：

- 04 文档已定义 Android 端的 `assets/knowledge/*.json` 组织方式。
- 十翼入库后，Android 端可从 `SHIYI_TEXTS` 导出为 `assets/knowledge/shiYi.json`（用 `JSON.stringify(SHIYI_TEXTS, null, 2)` 一行即可）。
- 本文档不涉及 Android 端设计。

### 8.6 数据降级策略（数据未就绪时的表现）

| 数据状态 | UI 表现 |
| --- | --- |
| **完全未就绪**（当前状态：仅有 L1 原始 HTML/JSON 存档，未解析结构化） | 十翼总览卡片全部灰显 + 「数据校对中 · 预计 XX 日上线」小字；卡片不可点；`shiYi.generated.ts` 尚未入库 |
| **部分就绪**（如系辭上已入库、其他未入库） | 就绪的篇可点进入；未就绪的篇灰显；组件按 `SHIYI_TEXTS.length` 动态渲染 |
| **注疏未解析**（M1 阶段） | 经原文正常显示；注疏区显示「注疏解析中」占位小字，不展开 |
| **注疏折叠状态丢失**（localStorage 无该键） | 默认折叠；首次用户看到的是"纯经原文"视图 |
| **字段缺失**（个别段无 note/quote） | 对应 UI 元素不渲染（与 GuaciYaoCiPanel 的降级路径一致，字段 `undefined` 即隐藏） |

### 8.7 数据源映射与解析管线（L1 → L2）

**Wikisource 页 → 篇 / 章 映射**：

| Wikisource 页 | 属篇 | 属章（未来） | 备注 |
| --- | --- | --- | --- |
| 07.01 | 系辭上傳 | 第一章 + 第二章开头 | 一个 Wikisource 页含两章片段，需切分 |
| 07.02 – 07.11 | 系辭上傳 | 第二 – 十一章 | 各页大致对应一章（需人工核对边界） |
| 07.12 | 系辭上傳 | 第十二章 | |
| 08.1 – 08.9 | 系辭下傳 | 第一 – 九章 | 页 = 章（一一对应） |
| 09.01 – 09.11 | 说卦傳 | 第一 – 十一章 | 页 = 章（一一对应） |
| 10 | 序卦傳 | 单章（1 篇 = 1 章） | 内容连续 |
| 11 | 杂卦傳 | 单章（1 篇 = 1 章） | 内容连续 |

**从 Wikisource HTML 到 `shiYi.generated.ts` 的完整转换管线**：

```
┌────────────────────────────────────────────────────────────────┐
│  L1 · Wikisource HTML 原始存档（34 页，~281KB）                  │
│  位置：C:\...\opencode\zys\pages_10\, pages_hans_10\            │
│  格式：含 <link>, <span class="mw-headline"> 等 HTML 结构        │
│  权威层：zh-hant（07.01–11）                                     │
│  交付层：zh-hans（07.01–11）                                     │
└────────────────────────────────────────────────────────────────┘
                        │
                        ▼  阶段 1：HTML 清洗
┌────────────────────────────────────────────────────────────────┐
│  L1.5 · 纯文本 + Wikisource 标记                               │
│  - 移除 <link>, 图片, 导航元素                                  │
│  - 移除 "维基百科，自由的图书馆" 顶部导航                        │
│  - 提取正文段落（保留 <p> 结构）                                │
│  - 保留 <span class="mw-headline"> 章标题锚点                   │
│  - 记录 oldid（用于溯源）                                        │
└────────────────────────────────────────────────────────────────┘
                        │
                        ▼  阶段 2：三层分离（经 / 注 / 疏）
┌────────────────────────────────────────────────────────────────┐
│  L1.6 · 分层文本                                                 │
│  - 疏层：以 `[疏]` 或 `○正义曰` 前缀识别（明确标记）              │
│  - 注层：注文夹在经原文之后，无显式标记；靠语义启发式识别         │
│      （如"正义曰"前的短句常为注；"某某注曰"前缀的整段为注）      │
│  - 经层：剩下的正文（十翼原文本身）                              │
│  启发式规则需人工校对确认（每章 1 次校对）                       │
└────────────────────────────────────────────────────────────────┘
                        │
                        ▼  阶段 3：结构切分
┌────────────────────────────────────────────────────────────────┐
│  L2 · 结构化数据（篇 → 章 → 段 → 注疏）                         │
│  - 篇识别：从文件名 07.xx / 08.x / 09.xx / 10 / 11 映射        │
│  - 章识别：                                                         │
│      * 系辭上：12 章，从 `此第 X 章` / 章首句 双重识别             │
│      * 系辭下 / 说卦：1 页 = 1 章（一一对应）                      │
│      * 序卦 / 杂卦：1 篇 = 1 章（连续文本）                        │
│  - 段识别：以「。」「！」「？」断句；长句 (>100 字) 人工切分        │
│  - 章题：从每章首句取前 4–8 字作为题（如「天尊地卑」）             │
│      * 序卦/杂卦不切章题                                          │
│  - 章引：从每章首句取前 20–40 字作为摘要                          │
└────────────────────────────────────────────────────────────────┘
                        │
                        ▼  阶段 4：人工校对（2 轮）
┌────────────────────────────────────────────────────────────────┐
│  L2.5 · 校对版                                                   │
│  - 与纸质或权威电子版逐段对照                                     │
│  - 校对记录归档到 docs/dev/knowledge-review/校对记录.md            │
│  - 校对人签名 + 日期                                             │
│  - 两轮校对（05 文档 §一 约定）                                    │
└────────────────────────────────────────────────────────────────┘
                        │
                        ▼  阶段 5：代码生成
┌────────────────────────────────────────────────────────────────┐
│  L3 · TS 数据文件                                                │
│  - 生成 `packages/knowledge/src/shiYi.generated.ts`              │
│  - 元组格式（§8.4）                                              │
│  - 通过 `npm run verify` 全量门禁                                │
│  - 提交 PR，附校对记录链接                                        │
└────────────────────────────────────────────────────────────────┘
```

**建议的工具脚本**（未来新增，交 orchestrator 决策是否纳入本仓）：

| 脚本 | 类型 | 作用 |
| --- | --- | --- |
| `scripts/shiyi-parse.js`（Node.js） | 生成 | 阶段 1 + 2 + 3 + 5 自动化，输出 L2 JSON + `shiYi.generated.ts` |
| `.workbuddy/checks/shiyi-validate.py` | 校验 | 校验结构完整性、字符数、章节数，纳入 `.workbuddy/checks/` 检查链 |
| `.workbuddy/checks/shiYi-consistency.py` | 校验 | 校验 `shiYi.generated.ts` 与 L2 JSON 一致（防止生成文件被手工修改） |

**为什么不直接手写生成 TS**：

- 34 页 × 平均 8KB = 270KB 原文，手写易错、校对困难。
- 自动化管线可重复执行（Wikisource 有 new oldid 时可重跑）。
- 校验脚本可捕获结构漂移（后续校对发现的错别字可回填到 L2 校对记录）。

### 8.8 校验与测试策略

**`packages/knowledge/test/shiYi.test.ts` 单元测试**（沿用 `knowledge.test.ts` 的模式，见 `packages/knowledge/test/knowledge.test.ts:148-156`）：

1. **结构完整性**（14 项断言）
   - `SHIYI_TEXTS.length === 5`
   - 5 个 slug 唯一且匹配 `ShiyiSlug` 联合类型
   - 每篇 `chapters.length === chapterCount`
   - 每章 `index` 从 1 开始连续递增
   - 每章 `paragraphs.length >= 1`
   - 每段 `index` 从 1 开始连续递增
   - `totalChars` 与实际字符数（去标点）一致
   - `source.pageIds.length === source.oldids.length`
   - 每段 `text` 非空且不含 Wikisource 链接标记（`[`、`]` 除外在书名号内）

2. **金标准测试**（对标 07 文档的「2026-08-15 午时 → 水风井」思路，用于校对回归）
   - 「天尊地卑，乾坤定矣」应在 `xi-ci-upper:1:1`（第一章第一段）
   - 「易有太极，是生两仪」应在 `xi-ci-upper:11`（第十一章，是故易有太极章）
   - 「有天地，然后万物生焉」应在 `xu-gua:1:1`（序卦传第一段）
   - 「乾刚坤柔，比乐师忧」应在 `za-gua:1:1`（杂卦传第一段）
   - 「昔者包犧氏之王天下也」应在 `shuo-gua:1:1`（说卦传第一段）

3. **数据源一致性**（与 Wikisource oldid 逐字节比对）
   - 抽样 5 个段落，与维基文库原文 diff
   - 记录到 `docs/dev/knowledge-review/校对记录.md`

4. **`validateShiyiData()` 运行时校验**
   - 类似 `validateKnowledgeBase()`
   - 组件挂载时调用，返回 `ShiyiIssue[]`
   - 生产环境不阻断渲染，仅 console.warn

**CI 门禁**：

- `npm run verify` 已包含 `version:check → typecheck → test → test:runtime → build`
- 十翼测试纳入 vitest 工作区，无需修改 verify 脚本
- 新增 `.workbuddy/checks/shiyi-validate.py` 应追加到 `verify` 命令链（或作为 `test` 阶段的额外步骤）

### 8.9 版本管理与交付节奏

**与本仓 `version.json` 的关系**：

- 本仓当前 version 0.3.0（见 `packages/knowledge/package.json`）
- 十翼 UI 与数据入库后，建议 minor 版本升级 → 0.4.0
- 触发点：`SHIYI_TEXTS` 首次非空入库、路由/组件首次上线
- 用 `npm run version:bump:minor` 自动同步 5 个 workspace 的 `package.json` + `apps/web/src/generated/version.ts` + 追加 CHANGELOG 条目

**CHANGELOG.md 追加条目**（未来实施时补）：

```markdown
## v0.4.0 · 2026-XX-XX

### 新增
- 十翼原文阅读视图（学习 Tab SegControl 第三档）
- `packages/knowledge/src/shiYi.ts` + `shiYi.generated.ts`（5 篇结构化数据）
- 新增路由 `#/shi-yi/:slug`
- 新增 3 个组件：ShiyiView / ShiyiOverview / ShiyiChapterNav

### 数据
- 系辭上傳 12 章 · 系辭下傳 9 章 · 说卦傳 11 章 · 序卦傳 1 章 · 杂卦传 1 章
- 数据源：《周易正义》维基文库，共 34 页，含两轮人工校对

### 校对记录
- docs/dev/knowledge-review/校对记录.md（第 XX 版）
```

**与本文档 §11 分期交付的对应**：

| 阶段 | 时间 | 存储层动作 |
| --- | --- | --- |
| **M1 · 骨架** | 1 周 | 仅路由 + 空组件 + 空 schema（`SHIYI_TEXTS = []` 或不含 `shiYi.generated.ts`） |
| **M2 · 数据接入** | 2 周 | `shiYi.generated.ts` 首次入库（5 篇或分批） + 注疏层（若 Q1 决策为 A） |
| **M3 · 交互增强** | 1 周 | 搜索索引（`allShiyiParagraphs()`）+ 交叉引用 + 深链 |

**与 05 文档 v2.0 的关系**（呼应 §8.5）：

- 若采用策略 A：05 升 v2.1，追加十翼一行 → 与本文档 v0.2 同批
- 若采用策略 B：05 文档不动，本文档作为十翼的独立权威
- 若采用策略 C：05 文档 §3.3 追加 M4 阶段项
- 交 orchestrator 决策（见 §12 Q8）

---
## 九、路由与导航

### 9.1 新增路由（对现有 `apps/web/src/router.ts` 的最小改动）

```typescript
export type RouteName =
  | 'cast'
  | 'result'
  | 'records'
  | 'record-detail'
  | 'learn'
  | 'shi-yi';  // ← 新增

function parse(hash: string): Route {
  // ...现有逻辑不变...
  case 'shi-yi':
    return seg[1]
      ? { name: 'shi-yi', params: { slug: seg[1] }, path: `/shi-yi/${seg[1]}` }
      : DEFAULT_ROUTE;  // /shi-yi 无 slug 时回退到学习页的十翼视图
  // ...
}

export const activeTab = computed<'cast' | 'records' | 'learn'>(() => {
  switch (current.value.name) {
    case 'records':
    case 'record-detail':
      return 'records';
    case 'learn':
    case 'shi-yi':  // 十翼归属于"学习" Tab
      return 'learn';
    default:
      return 'cast';
  }
});

const PARENT_PATH: Partial<Record<RouteName, string>> = {
  'record-detail': '/records',
  'shi-yi': '/learn?tab=shiYi',  // 新增：阅读页返回到学习十翼视图
};
```

**要点**：

- **十翼阅读页的 `activeTab` 归属为 `'learn'`** —— 侧栏/底部导航的「学习」高亮。
- `PARENT_PATH['shi-yi']` 定义返回落到 `#/learn?tab=shiYi`，与 `#/records/:id` → `#/records` 的形态一致。
- `#/shi-yi`（无 slug）回退到 `#/learn?tab=shiYi` —— 保证直接访问深链也不会 404。

### 9.2 `SegControl` 扩展（`apps/web/src/views/LearnView.vue`）

```typescript
type View = 'xx' | 'grid' | 'shiYi';

const viewOptions = [
  { value: 'xx' as const, label: '八卦类象' },
  { value: 'grid' as const, label: '六十四卦' },
  { value: 'shiYi' as const, label: '十翼' },
];
```

**注意**：现有 `LearnView.vue` 的 `view` 是内存 ref，切换即失忆。**建议**：改用 URL query（`#/learn?tab=shiYi`）持久化，与「记住上次选择」的产品口径对齐（06 §3.1 起卦页方式选择器已有该口径）。此为**顺带建议**，非十翼项目专属要求；如采纳，可一并改 SegControl 的 URL 双向绑定。

---

## 十、与现有组件的关系与复用

### 10.1 新增组件（预计）

| 组件 | 位置 | 说明 |
| --- | --- | --- |
| `views/ShiyiView.vue` | `apps/web/src/views/` | 单篇阅读视图（本文档 §3.2 的核心） |
| `components/ShiyiOverview.vue` | `apps/web/src/components/` | 五篇总览（本文档 §3.1） |
| `components/ShiyiChapterNav.vue` | `apps/web/src/components/` | 章目录抽屉（侧栏或抽屉形态） |
| `components/ShiyiFontSizeControl.vue` | `apps/web/src/components/` | 字号档位切换（- / + / A 按钮组） |
| `components/ShiyiAnnotationBlock.vue` | `apps/web/src/components/` | 注疏折叠块 |

### 10.2 复用现有资产

| 现有资产 | 复用方式 |
| --- | --- |
| `tokens.css` 全套令牌 | 直接消费，不新增 |
| `base.css` 全局 reset | 直接继承 |
| `SegControl.vue` | 学习页顶部三段切换（新增第三档） |
| `NavList.vue` | 侧栏/底部 Tab 无需改动（十翼归入「学习」） |
| `App.vue` 布局壳 | 阅读页作为 `<component :is="view">` 的一个 view 分支加入 |
| `ConfirmDialog.vue` | 无（本文档无二次确认场景） |
| `ToastHost.vue` | 复制成功时 toast（若做「复制本章」功能） |
| GuaciYaoCiPanel 的动效模式 | 注疏展开/折叠沿用 `grid-template-rows 0fr → 1fr` 手法 |
| GuaciYaoCiPanel 的复制按钮 | 若做「复制本章」，复用 `COPY_SVG` / `CHECK_SVG` 图标 |

### 10.3 与 GuaciYaoCiPanel 的样式约定

两份组件的**正文经原文样式**必须保持视觉一致（同一「经原文」在两个视图中应看起来是同一段文字）：

```css
/* 建议提取为共享类，或写在一处 style 中 */
.shi-yi-prose,
.gya-text {  /* GuaciYaoCiPanel 的现有类 */
  font-family: var(--font-serif);
  font-size: clamp(17px, 4.4vw, 18px);
  line-height: 2.0;
  letter-spacing: 0.5px;
  color: var(--c-text);
}
```

**未来重构建议**：把「经原文段落」的样式提取到 `styles/prose.css`，两个组件共同引用。本文档只提出建议，具体实施交 orchestrator 决定。

---

## 十一、分期交付建议

### M1 · 骨架（预计 1 周）

**目标**：UI 骨架可跑通，数据以 mock 形式内联，验证信息架构和视觉语言。

**产出**：

- [ ] 新增 `views/ShiyiView.vue` + `components/ShiyiOverview.vue`
- [ ] 5 篇 mock 数据内联在 `ShiyiView.vue`（不入库）
- [ ] 十翼总览页 5 卡片布局
- [ ] 单篇阅读页布局（顶栏 + 正文 + 页脚）
- [ ] 字号档位控制（`localStorage` 持久化）
- [ ] 章目录侧栏（桌面）/ 抽屉（移动）
- [ ] 键盘 ←/→ 切章 + Esc 返回
- [ ] Router 新增 `shi-yi` 路由 + `activeTab` 归属
- [ ] 学习页 SegControl 加第三档

**不做什么**：

- 不接入真实数据
- 不做搜索
- 不做注疏折叠（先显示占位）
- 不做阅读进度持久化

**验证点**：

- 桌面/移动两种形态下的排版正确性
- 字号档位切换无破版
- 与 GuaciYaoCiPanel 的经原文视觉一致性

### M2 · 数据接入（预计 2 周）

**前置**：外部团队完成 34 页 HTML 的解析与校验（经/注/疏分离 + 章边界标注）。

**产出**：

- [ ] `packages/knowledge/src/shiYi.ts` 入库（含 5 篇结构化数据）
- [ ] 注疏折叠/展开功能上线
- [ ] 注疏字号与颜色与主正文视觉分层
- [ ] 数据源信息（旧 oldid、URL）在页脚展示
- [ ] 繁体/简体切换（可选）—— 见 §12 Q3

**验证点**：

- 5 篇数据完整可读
- 注疏不喧宾夺主（默认折叠态视觉验证）
- 繁简体切换无字符缺失

### M3 · 交互增强（预计 1 周）

**产出**：

- [ ] 全文搜索（本地索引，`IDB` 或内存倒排表）
- [ ] 阅读进度持久化（`localStorage`）+ 总览页显示"已读至第 X 章"
- [ ] 未来"从卦的《大象》跳《说卦传》对应章"的跨视图跳转（依赖 §12 Q5）
- [ ] 深链支持（`#/shi-yi/xi-ci-upper?ch=3` 直接跳到第三章）

**验证点**：

- 搜索响应时间 < 100ms（34 页全量数据）
- 跨视图跳转正确

---

## 十二、待确认的关键问题（Open Questions）

以下问题在实施前需 orchestrator + 产品决策：

### Q1 · 注疏是否纳入 M1 展示？

- **方案 A**（推荐）：M1 只展示经原文；注疏 M2 才接入。
- **方案 B**：M1 一并接入，作为可选展开层。
- 影响：M1 工作量差 3–5 天；数据解析复杂度差约 2 倍。

### Q2 · 注疏展示形式：并列式 vs 折叠式？

- **方案 A**（推荐）：折叠式（本文档 §4.3 采用），默认折叠、可展开。
- **方案 B**：并列式（原文 + 注疏左右分栏），仅桌面适用。
- 影响：并列式在移动上无法实现；折叠式对老年用户更友好。

### Q3 · 是否提供繁简体切换？

- 现有 09 文档确立「zh-hant 权威层 + zh-hans 交付层」的双层数据策略。
- 应用内是否暴露繁简体切换开关？如暴露，放在哪里（阅读页顶栏 vs 全局设置）？
- 影响：切换开关涉及全局设置项新增，跨视图一致性问题。
- 建议：M1 不做，M2 视数据准备情况再定。

### Q4 · 章节导引的"章题"与"章引"从哪来？

- 系辭上/下传的每章在原文中有明确的"此第 X 章"标识，可从原文提取。
- 说卦传的 11 章传统有固定章题（如「上古者包犧氏」等）—— 是否有权威列表？
- 序卦传/杂卦传无分章，是否需要人工提炼"章节要点"作为章题？
- 影响：M2 数据入库时需要人工校对。

### Q5 · 与 GuaciYaoCiPanel 的跨视图跳转如何设计？

- 场景：用户在卦详情读《大象·井》时，能否一键跳《说卦传》中讲坎井的段落？
- 需要**双向映射表**：`hexagram.code → shiyiText.slug → chapterIndex → paragraphIndex`。
- 该映射是否属于 05 文档的知识库范围？还是本文档的 UI 附属产物？
- 建议：M3 才做；先与 orchestrator 确认归属。

### Q6 · 阅读视图是否要"沉浸模式"？

- 沉浸式阅读：隐藏顶栏、隐藏 Tab、全屏只留正文 —— 类似 iBooks / Kindle 阅读模式。
- 现有 App.vue 的顶栏/侧栏是全应用外壳，隐藏会打断导航心智。
- 建议：不做沉浸模式，但做「最小化 UI」—— 用户 3 秒不操作，顶栏/页脚半透明淡出。M3 考虑。

### Q7 · 是否支持"打印本页"？

- 老年用户/学者可能希望把某一篇/某几章打印出来。
- 浏览器原生 `Ctrl+P` 已经能打印，但打印样式需要单独适配。
- 建议：M3 加一层 `@media print` 样式即可，不需要专门 UI。

### Q8 · 十翼是否作为 05 文档知识库的第 4 个数据集正式收录？

- 现有 `05-卦象知识库设计.md` v2.0 §一 列 3 个数据集：trigrams / hexagrams / strokes。
- 十翼入库后是否升 05 到 v2.1、把十翼作为第 4 个数据集正式收录？3 种策略见 §8.5：
  - **策略 A（推荐）**：05 升 v2.1，追加十翼一行 → 与本文档 v0.2 同批
  - **策略 B**：05 文档不动，十翼归属本文档独立管辖
  - **策略 C**：05 文档 §3.3 追加 M4 阶段项，本次不升版本号
- 交 orchestrator 决策。
- 影响：策略 A 需同步更新 `docs/dev/05-*.md` v2.1 与 `docs/dev/README.md` §一 版本列（只读镜像）。

---

## 十三、附录

### 13.1 完整 wireframe（十翼总览页，桌面形态）

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌ 观梅·PLUMORA ───────────────────────────── [布局][真机框][⚙]┐  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│        侧栏（232px）                主内容区（≤ 1080px）          │
│  ┌──────────┐    ┌──────────────────────────────────────────┐  │
│  │ ● 起卦   │    │  [八卦类象] [六十四卦] [十翼]               │  │
│  │ ● 卦例   │    │                                          │  │
│  │ ● 学习 ● │    │  十  翼                                    │  │
│  │          │    │  周易五篇经典原文                            │  │
│  │ ───────  │    │                                          │  │
│  │ 设置     │    │  ┌────────────────┬────────────────┐    │  │
│  │ 二维码   │    │  │ 《系辞上传》    │ 《系辞下传》    │    │  │
│  │          │    │  │ 12 章 · 6.8万  │ 9 章 · 5.2万    │    │  │
│  │          │    │  │               │                  │    │  │
│  │          │    │  │ "天尊地卑，    │ "一阴一阳之谓    │    │  │
│  │          │    │  │  乾坤定矣…"   │  易…"             │    │  │
│  │          │    │  │               │                  │    │  │
│  │          │    │  │ [阅读 →]       │ [阅读 →]         │    │  │
│  │          │    │  └────────────────┴────────────────┘    │  │
│  │          │    │  ┌────────────────┬────────────────┐    │  │
│  │          │    │  │ 《说卦传》      │ 《序卦传》       │    │  │
│  │          │    │  │ 11 章 · 2.9万  │ 1 篇 · 1.7万    │    │  │
│  │          │    │  │               │                  │    │  │
│  │          │    │  │ "昔者包犧氏观 │ "有天地，然后    │    │  │
│  │          │    │  │  天…"          │  万物生焉…"      │    │  │
│  │          │    │  │ [阅读 →]       │ [阅读 →]         │    │  │
│  │          │    │  └────────────────┴────────────────┘    │  │
│  │          │    │  ┌────────────────────────────────┐    │  │
│  │          │    │  │ 《杂卦传》                        │    │  │
│  │          │    │  │ 1 篇 · 0.5万                     │    │  │
│  │          │    │  │                                  │    │  │
│  │          │    │  │ "乾刚坤柔，比乐师忧…"             │    │  │
│  │          │    │  │ [阅读 →]                          │    │  │
│  │          │    │  └────────────────────────────────┘    │  │
│  │          │    │                                          │  │
│  │          │    │  阅读指南 ▾（可折叠）                     │  │
│  │          │    │  五篇共 34 页 · 合计 17.1 万字            │  │
│  │          │    │  与卦辞/爻辞/彖象/文言的关系……            │  │
│  └──────────┘    └──────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 13.2 完整 wireframe（阅读页 · 单篇 · 桌面形态）

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ← 学习    系辭上傳 · 第三章          [A-] [A] [A+]  [⋯] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌ 侧栏 ┐ ┌ 主内容区（≤ 720px 居中）─────────────────────┐     │
│  │      │ │                                              │     │
│  │ 章  目│ │   ● 三                                     │     │
│  │       │ │                                              │     │
│  │ ① 天  │ │   彖者，言乎象者也；象者，像也。              │     │
│  │ ② 圣  │ │                                              │     │
│  │ ③ 彖  │ │   彖者，言乎象者也。象者，像也；                │     │
│  │  ④ 精  │ │   刚柔者，昼夜之象也。                      │     │
│  │  ⑤ 显  │ │   乾动而直，坤静而方，                     │     │
│  │  ⑥ 圣  │ │   卑高以陈，贵贱位矣。                     │     │
│  │  ⑦ 初  │ │                                              │     │
│  │  ⑧ 大  │ │   ┌─ 注疏 ────────────────────────┐        │     │
│  │  ⑨ 子  │ │   │ 【注】彖者，序也。言卦之      │        │     │
│  │  ⑩ 天  │ │   │    序也。象者，似也。……        │        │     │
│  │  ⑪ 是  │ │   │                                   │        │     │
│  │  ⑫ 子  │ │   │ [展开 ▾]                         │        │     │
│  │       │ │   └───────────────────────────────────┘        │     │
│  │       │ │                                                  │     │
│  │       │ │   ─ ─ ─                                          │     │
│  │       │ │                                                  │     │
│  │       │ │   · 关键概念：刚柔、动静、天尊地卑 ·              │     │
│  └──────┘ └────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 阅读进度 ●─●─●─●─●─○─○─○─○─○─○─○                        │  │
│  │  ← 上一节     3 / 12     下一节 →                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 13.3 章号圈数字参考表

用于章导引区、目录、进度条等所有"章位置"标识：

| 章号 | 圈数字 | 说明 |
| --- | --- | --- |
| 第一章 | ① | 与 GuaciYaoCiPanel 爻位 ①②③④⑤⑥ 同款符号 |
| 第二章 | ② | 12 章以内完全覆盖（①–⑫ 均为常用 Unicode 圈号） |
| …… | …… | |
| 第十二章 | ⑫ | 覆盖 12 章上限（系辭上/说卦传的最大章数） |

超出 12 章的场景（未来若扩展"文言传"等）需换用其他符号系统（如「章 13」「第三章十三」），届时新增设计考量。

### 13.4 视觉参考对照

| 参考对象 | 相似点 | 差异点 |
| --- | --- | --- |
| GuaciYaoCiPanel | 经原文样式一致（宋体、朱砂点缀） | 本文档是长滚动单篇；GuaciYaoCiPanel 是短段落分组 |
| 结果页（`ResultView.vue`） | 顶栏 + 内容区布局 | 本文档无卦符、无结论卡 |
| 学习页六十四卦速查 | SegControl 顶部切换 | 本文档在 SegControl 下是长文阅读，不是宫格矩阵 |
| 古籍电子化网站（如 zh.wikisource.org） | 章目录 + 正文的阅读布局 | 本文档有注疏分层与朱砂点缀，视觉更"中式" |

### 13.5 设计决策记录（简短）

| 决策 | 选择 | 备选 | 理由 |
| --- | --- | --- | --- |
| 入口位置 | 学习 Tab 第三档 | 独立顶层 Tab / 独立设置入口 | 保持底部 3 Tab 结构不变；与"学习"心智一致 |
| 单篇路由 | 独立路由 `/shi-yi/:slug` | 留在 `/learn?tab=shiYi` 下 | 长文阅读需独立路由支持深链分享 |
| 章节目录形态 | 桌面侧栏 + 移动抽屉 | 顶部横排 / 底部弹窗 | 侧栏利用桌面横向空间；抽屉保留移动拇指热区 |
| 正文对齐 | 左对齐 | 居中 / 两端对齐 | 中文长文阅读最佳实践；两端对齐在中文下有断字问题 |
| 正文行距 | 2.0 | 1.6 / 1.8 | 长文阅读黄金区间上沿；老年用户友好 |
| 注疏默认状态 | 折叠 | 展开 / 隐藏 | 折叠保留信息可见性又不喧宾夺主 |
| 章号符号 | Unicode 圈号 ①–⑫ | 阿拉伯数字 / 中文数字 | 与 GuaciYaoCiPanel 爻位角标符号语言一致 |
| 字号档位 | 7 档，15–21px | 5 档 / 3 档 | 1px 间隔粒度足够；7 档覆盖视力衰退用户 |
| 与 GuaciYaoCiPanel 关系 | 姊妹设计（不共享代码，共享视觉语言） | 合并为一个通用组件 | 数据 schema 完全不同，硬合并会引入不必要的复杂度 |
| 沉浸模式 | 不做 | 3 秒无操作淡化顶栏/页脚 | 与全应用导航心智一致；淡化策略引入状态管理复杂度 |

---

## 十四、附录：与相关文档的关系矩阵

| 文档 | 关系 | 影响 |
| --- | --- | --- |
| `06-UI-UX设计规范.md` v3.0 | 视觉权威源 | 本文档**不修改** 06；如需新增口径（如注疏专用色板），交 orchestrator 统一协调 |
| `09-原文校对与校对方法.md` v2.0 | 数据权威层/交付层 | 数据解析方案沿用 09 的双层策略 |
| `docs/dev/knowledge-review/design/卦级原文聚合展示-UI设计规格.md` v0.2 | 姊妹设计 | 视觉语言一致；数据 schema 平行；未来可共享 prose 样式 |
| `05-知识知识库.md` v2.0 | 知识库范围 | 十翼文本入库后属知识库 M2 内容（05 §3.3），需与知识库 schema 决策协同 |
| AGENTS.md（仓根） | 工程约束 | 不引入新依赖；数据内联为 `generated/*.ts`；不发网络请求 |

---

**变更记录**：

| 版本 | 日期 | 变更内容 |
| --- | --- | --- |
| v0.2 | 2026-09-26 | 补充存储结构设计：§8 由「数据结构建议」重写为「存储与数据结构设计」（9 个子节）——新增 §8.1 设计原则、§8.2 文件组织方案、§8.3 完整 TypeScript 接口（ShiyiSlug / ShiyiChapterId / ShiyiParagraphId / ShiyiText / ShiyiChapter / ShiyiParagraph / ShiyiAnnotation 等 9 个类型）、§8.4 元组数据组织策略（shiYi.generated.ts 示例）、§8.5 与 05 文档知识库 3 策略集成方案、§8.6 数据降级策略、§8.7 L1→L2 五阶段解析管线、§8.8 校验与测试策略（14 项断言 + 5 项金标准）、§8.9 版本管理与交付节奏（v0.4.0 CHANGELOG 模板）；§12 新增 Q8（十翼是否作为 05 第 4 个数据集收录，A/B/C 三策略）；文档头版本号升 v0.2、修正 09 文档名为「09-卦辞爻辞录入方案.md」、关联文档补 05 v2.0 / 04 v1.9 |
| v0.1 | 2026-09-26 | 初版编制：十翼五篇的展示视图设计（总览 + 阅读）；数据 schema 建议；分期交付方案；7 项待确认问题（Q1–Q7）交 orchestrator 决策 |
