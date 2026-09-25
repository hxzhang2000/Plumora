# 变更日志

观梅 · Plumora 的**产品版本**变更记录。Web 端与 Android 端**共用同一版本号**，真源为仓根 `version.json`，改版本一律走 `npm run version:bump`（详见 [docs/dev/08-版本计划与发布规范.md](docs/dev/08-版本计划与发布规范.md) §一）。

> ⚠️ 本文件记的是**产品版本**。各设计文档另有独立的**文档版本**，记在各自末尾的变更日志里，两套体系互不联动（见 [docs/dev/README.md](docs/dev/README.md) §四）。

写法：每条只写「做了什么」，不写动机论述；多处改动用 ①②③ 编号。

---

## [Unreleased]

## [0.1.0] - 2026-09-25

**Web 端首个可用版本**（Android 端尚未开工）

**工程**

- 建立 npm workspaces monorepo：`packages/knowledge`、`packages/core`、`packages/lunar`、`apps/web`
- 共享层与平台解耦：core 定义 `LunarProvider` 端口，Web 端注入 solarlunar 实现，Android 端后续注入 lunar-java
- 版本号统一管理：`version.json` 单一真源 → 派生 5 个 package.json + Web 端 TS 常量 + Android versionName/versionCode，`npm run version:check` 接入门禁
- 一键启动脚本：`start.bat`（纯 ASCII 启动壳，cmd / PowerShell 通用）+ `start.ps1`（UTF-8 with BOM，承载中文提示），自动检查环境与依赖、起本地服务、等服务真正就绪后打开默认浏览器；`.gitattributes` 对 `*.bat` / `*.cmd` / `*.ps1` 锁定 `eol=crlf`

**功能**

- 起卦：时间 / 数字 / 汉字笔画 / 声音点数 / 随机 五种方式
- 排盘：本卦、互卦、变卦、动爻、体卦/用卦、五行生克五级结论（大吉 / 小吉 / 吉 / 小凶 / 大凶）
- 卦例：本地保存、备注、应验标记、列表、关键字搜索、导出 JSON / CSV
- 卦例名称：列表与详情优先取「所问之事」（占卜目标），未填写时依次回退到本卦卦名、「起卦方式 · 农历」，规则在 `@plumora/core` 的 `recordTitle()` 内两端共用
- 学习：起卦方法说明、八卦类象速查（10 类目）、六十四卦速查（8×8 宫格）
- 设置：笔画标准（简/繁）、默认起卦方式、体用判定流派、主题、保留记录上限

**界面**

- 自适应排版：< 900px 顶栏 + 底部 3 Tab；≥ 900px 左侧栏 232px + 居中内容区
- 浅色 / 深色 / 跟随系统主题，设计令牌走 CSS 自定义属性
- 卦符自绘（DOM + CSS），不依赖 Unicode 字体渲染
- 品牌图标：印章形态（朱砂底 + 白文竖排小篆「觀梅」）作 favicon 与页头 / 侧栏品牌标，纯字标用于设置面板「关于」区；字形由 AI 生成后矢量化，不依赖第三方字体
- 卦例列表主标题改为卦例名称（单行截断 + 原生 title 提示），卦名移至副行且标题已是卦名时不重复；详情页页头与删除确认文案同步改用卦例名称

**测试**

- 154 项单测（core 81 / knowledge 28 / lunar 33 / web 12），含金标准算例 A、B 与「既济互未济」验证 → **第 2 轮审查后为 178 项**（core 83 / knowledge 28 / lunar 33 / web 34），见下方第 2 轮小节
- 运行时冒烟：应用打成单文件 IIFE 后在 jsdom 中逐路由执行，抓「挂载即白屏」类缺陷；并断言版本号与品牌图标接线（含「引用的资源文件必须真实存在于 public/」，防 404）
- 运行时冒烟新增「结果页保存 → 列表按名称显示」端到端断言；jsdom 无 IndexedDB，脚本自带最小替身 `apps/web/scripts/idb-stub.cjs`（含 `IDB_STUB_SELFTEST=1` 自检开关，用于证明该断言不会空转）
- 文档集自查脚本 3 个（22 / 32 / 64 项断言）全绿 → **第 2 轮审查后为 22 / 58 / 64**

**代码审查修复（首轮全量代码审查，2026-09-25）**

共享层（`packages/knowledge` / `packages/core` / `packages/lunar`）：

- C-1 统一年支口径：新增 `yearBranchNoOf()` / `ganzhiYearOf()` 作为唯一干支源，时间起卦标签的干支年改由 `lYear` 派生（原取农历库的 `gzYear`，为立春口径，每年约 13 天与算法矛盾，会出现「界面写丙午年、算法按巳=6 计算」）
- C-2 卦代码补零为两位段（`06-05`），新增 `hexCodeOf()` / `normalizeHexCode()`；`getHexagramByCode()` 兼容非补零写法
- C-3 新增繁体→简体别名表 `TRADITIONAL_ALIAS`，繁体字面可直接查笔画（原一律 miss）
- C-4 闰月断言由恒真改为直接断言 `lMonth` / `monthCn` / `isLeap`；`castByTime` 对 `lMonth` 取绝对值兜底
- C-5 随机起卦校验随机源区间（原 `as` 断言掩盖越界，`random()=1` 会产出 upper=9）；`resolve()` / `replayRecord()` 入口校验先天数（原脏数据以 TypeError 崩溃）
- C-6 时间 / 数字 / 汉字三处起卦入口补 `Number.isInteger` 校验（原非整数被静默截断，展示的中间量与结果不符）
- C-7 `castByCharacter` 校验 `chars` 与 `strokes` 等长且非空（原会静默丢字、渲染出「undefined 16 画」）
- C-8 `inputParams` 的 TIME 增加 `shifted` 字段，晚子时可复盘
- C-9 知识库导出常量补 `Object.freeze`（`TRIGRAMS` / `HEXAGRAMS` / `STROKES` / 类目表及其条目、`keywords` 数组）
- 单测 114 → 154 项；新增 TC-LC08 全范围逐日穷举（1900–2100 共 73,384 天不变量 + 公↔农往返一致性），并借此暴露 solarlunar `lunar2solar` 的闰月第 30 天缺陷 17 例

原型与文档：

- D-1 修原型 `docs/ui/build/core.js` 闰月标签「闰闰六月」（`monthCn` 已含「闰」前缀，不得再拼一次），同步补 C-1 / C-2 口径
- 新增 `docs/ui/build/pack.py`：把 `build/` 源内联进单文件 HTML 从手工粘贴变为一条命令
- 原型 jsdom 冒烟 30 → 42 断言（补算法口径回归 12 条）
- 文档同步：03 v1.5（§6.1 年界口径）、04 v1.6（§2.4 `shifted` / §2.5 卦代码补零）、05 v1.5（§4.1 表键与别名口径）、01 v1.6（NFR-05 改为可执行口径）、07 v1.9（补 TC-T04 / TC-C07 / TC-R01 / TC-LC06–08 / TC-ST06 / TC-KB01–04 / TC-IP01）

**代码审查修复（第 2 轮：Web 应用层 / 工程门禁 / 文档与原型，2026-09-25）**

Web 应用层（`apps/web`）：

- W-1 / W-2 确认弹窗在 `KeepAlive` 缓存下会跨页面残留：`onDeactivated` 复位 + 弹窗内焦点作用域（`contains` 判据）+ 按 Enter 时若焦点在按钮上不再重复触发确认；`onBeforeUnmount` / `onDeactivated` 双向解锁 `body` 滚动
- W-3 `CastView` 的起卦方式由组件内 `ref` 改为直绑设置的 `computed({get,set})`，消除「设置面板改了、起卦页还是旧值」的双真源
- W-4 详情页区分「未找到」与「读取失败」，前者不再是唯一的错误出口；保存 / 删除失败给出具体原因而非静默
- W-5 IndexedDB 打开失败后复位 `dbPromise`，隐私模式 / 站点数据被禁下下一次调用可自愈（原实现把已 reject 的 promise 永久缓存，用户需手动刷新）
- W-6 CSV 导出中和公式注入：以 `=` `+` `-` `@` `\t` `\r` 开头的字段前缀单引号（原引号包裹只解决字段分隔，挡不住 Excel/WPS 求值）
- W-7 设置抽屉关闭时加 `inert` + `aria-hidden="true"`（原 Tab 焦点会走进看不见的面板）；`visibility` 参与过渡避免「关不掉」
- W-8 无障碍补全：`SegControl` 重写为 `role="radiogroup"` + 方向键 / Home / End 导航 + roving tabindex；表单补 `for`/`id` 与 `aria-label`
- W-9 / W-10 卦例列表：错误态与空态互斥（不再同时出现），列表项支持键盘 Enter / Space 进入详情
- W-11 首屏 `theme-color` 初值改为浅色底色，内联脚本按主题改写（原深色值在浅色主题下闪一下）
- W-13 `KeepAlive` 加 `:max="6"`，避免无限缓存
- W-14 `goBack()` 改为按路由层级判断（原依赖 `history.length > 1`，从外部站点深链进详情页后点「返回」会跳出应用）
- W-15 未知 hash 回退到 `/cast` 时同步改写 URL（原地址栏长期停留 `#/foo`，与实际页面不一致）
- 新增护栏：`apps/web/test/router.test.ts`（10 项）覆盖 07 文档 TC-W12，`apps/web/test/records.test.ts`（10 项）覆盖 TC-D01~D04 / D06 与 W-5 自愈；单测 web 12 → 34
- 运行时冒烟 7 → 9 条：新增「弹窗残留」（W-1/W-2，含正向对照与 Enter 不误删）与「设置抽屉 `inert`」（W-7）；`#/records` 断言收紧为路由特有空态文案

工程门禁与配置：

- I-1 `npm run verify` 补第五步**生产构建**（原四步全绿但构建可能挂）
- I-2 / I-10 `scripts/version.mjs`：`fail()` 由 `process.exit(1)` 改为抛 `VersionError`，入口统一捕获；`bump` 在同步失败时打印恢复步骤；gradle 目标补字段存在性校验
- I-3 / I-4 `apps/web` 的 tsconfig include 补 `build/**/*.ts` 与两个 vite 配置；三个纯逻辑包删除 `"types": ["node"]`（零 Node 全局引用，Android 可同步复用）
- I-5 `.workbuddy/` 逐目录决策：`checks/` 有意入库，`memory/` 与 `migrations/` 加 `.gitignore` 并 `git rm --cached`
- I-6 收紧 `engines` 为 `^20.19.0 || >=22.12.0`，新增 `.nvmrc` 与 `.npmrc`（`engine-strict=true`）
- I-7 / I-9 冒烟新增两条断言（见上）；`idb-stub.cjs` 的 `put()` 也受 `IDB_STUB_SELFTEST` 控制，替身调度器可注入（默认 `setTimeout`，批量用例传 `queueMicrotask` 绕开 Windows 15.6ms 时钟节拍）
- I-8 新增 `apps/web/public/manifest.webmanifest` 并在 `index.html` 挂载（PWA，移动端 Web）
- 新增 `.github/workflows/ci.yml`：`npm ci && npm run verify`，门禁不再依赖「人记得跑」

文档与原型：

- D-1 `doc-case-check.js` 补农历口径组（TC-LC01/LC02/LC06/LC07），直接对拍 `packages/lunar`，覆盖闰月与年界两处最易漂移的契约
- D-2 新增 `docs/README.md`：声明 `*.docx` 仅为导出快照、`.md` 是唯一权威、docx 不参与版本体系与自动化校验（7 份 docx 仍含已修订错值「山水蒙」的根因）
- D-3 / D-11 07 文档用例号与实现对齐：补登记 TC-N06 / TC-H05 / TC-W13~W15，新增 TC-D04b / TC-D06b，TC-D05 与 TC-KW02 标注 ⏳ 未实现 / M1 待执行，TC-D07 补上真实用例（原先只有号）
- D-4 三个自查脚本改对拍**交付实现**（`packages/knowledge` + `packages/core` + `packages/lunar`，经 `load-delivery.cjs` 用 esbuild 即时 bundle），B 组再做「原型 ↔ 交付」交叉一致性；`doc-case-check.js` 32 → 58 项
- D-5 / D-6 / D-7 05 / 06 文档八卦类象类目 9 → 10 类（补「五味」）并与 `TRIGRAM_CATEGORIES` 逐列对齐；`HexagramGlyph` 补规范 `aria-label`；触控目标 44 → 48px；`tokens.css` 注释版本同步
- D-8 索引与原型 README 的版本镜像列纠偏（dev/README v1.12、ui/README v1.4）
- D-9 / D-10 生克 `summary` 文案与原型统一（「体用比和：吉，顺利和谐」「耗损精力」），并重跑 `build/pack.py` 重新内联单文件 HTML
- 新增 `LICENSE`：未采用开源许可证，保留全部权利（README 同步补版权段）
