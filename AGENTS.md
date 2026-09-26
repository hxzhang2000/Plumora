# AGENTS.md

观梅 · Plumora — 梅花易数起卦排盘工具。纯静态前端（Vue 3 + TypeScript + Vite），无后端，全功能离线。文档与代码注释均为中文，新写的说明文字保持中文。

仓根有 `.codegraph/` 索引：理解代码结构 / 找调用关系优先用 `codegraph_explore`，别先 grep。

## 命令

- `npm run verify` — **提交前必跑**，CI 跑的是同一条。固定顺序：`version:check → typecheck → test → test:runtime → build`，不要跳步或改顺序。
- `npm run dev` — Vite dev server（apps/web，端口 5173，`host: true` 监听局域网供手机扫码）。
- 单测按子串过滤：`npm run test -w @plumora/core -- golden`（vitest 过滤串，实测可用）。单包类型检查：`npm run typecheck -w @plumora/web`。
- **全仓没有 ESLint / Prettier / format 脚本**——不要找，`verify` 就是全部门禁。
- Node 必须 `^20.19.0 || >=22.12.0`（.nvmrc=22；.npmrc `engine-strict=true`，版本不满足时 install 直接失败）。

## 版本号（最易踩的坑）

- 真源是仓根 `version.json`（Web 与 Android 共用）。5 个 workspace 的 `package.json` + `apps/web/src/generated/version.ts` 是**派生目标：绝不手工编辑**。改版本一律 `npm run version:bump:patch|minor|major`（自动同步派生目标 + 向 CHANGELOG.md 插入条目）。
- `version:check` 对派生目标逐字节比对，任何漂移即 fail，已纳入 `verify`。
- **软件升版规则（与文档版本体系无关，勿套用 08 文档规则）**：改 BUG → patch（0.0.X）；加/减功能 → minor（0.X.0）；大重构 → major（X.0.0）。

## 工程结构

- npm workspaces：`packages/{knowledge,core,lunar}` + `apps/web`。
- 三个 package 均为**源码直出 TS**（`main` 指 `./src/index.ts`，无预构建步骤）。依赖方向：`knowledge`（纯数据，零依赖）← `core`（起卦/排盘纯逻辑，只依赖 knowledge）← `lunar`（实现 core 定义的 LunarProvider 端口，基于 solarlunar）。`apps/web` 依赖全部三个。
- 路径别名 `@plumora/*` 与 `@` 集中定义在 `apps/web/build/aliases.ts`，vite 与 vitest 共用——新增包或改路径只改这一处。
- ⚠️ 仓根 `package.json` **禁止加** `"type": "module"`：会把 `.workbuddy/checks/*.js` 这些既有 CommonJS 工具链当 ESM，检查脚本全部跑不起来。

## 契约文档（改代码前先查对应文档）

- 权威契约是 `docs/dev/*.md`；同名 `.docx` 只是导出快照，冲突一律以 `.md` 为准，**不要改 `.docx`**（范围声明见 `docs/README.md`）。
- 每份文档**独立版本号**：改正文 → 头部「文档版本」+1 → 末尾变更日志追加一行，三件事同一轮完成；`docs/dev/README.md` §一 的版本列只是只读镜像，不是权威。
- 算法口径以 `03-起卦核心算法设计.md` 为准，两组金标准算例必须通过：`2026-08-15 午时 → 水风井`、`梅/花 → 火地晋`（实现见 `packages/core/test/golden.test.ts`，用例明细在 07 文档）。
- UI 布局口径以 `06-UI-UX设计规范.md` 为准（六爻自上而下、动爻高亮）。
- 改 `docs/` 后跑自查：`python .workbuddy/checks/docset-selfcheck.py`、`node .workbuddy/checks/doc-case-check.js`、`python .workbuddy/checks/kb-consistency.py`（对拍的是**交付实现** `packages/*`，不是原型）。

## Windows 文件坑

- `start.bat` 必须保持**纯 ASCII**（cmd 按当前控制台代码页解析，含中文的 UTF-8 bat 会乱码）；全部中文逻辑放 `start.ps1`，存为 **UTF-8 with BOM**。
- `.gitattributes` 对 `*.bat` / `*.cmd` / `*.ps1` 显式锁 `eol=crlf`——LF-only 会让 `goto`/标签解析出错，不要「修复」成 LF。

## 其他约束

- 产品承诺离线：**不发任何网络请求**——不要引入 CDN 字体、远程 API、遥测。
- 项目未附开源许可证（保留全部权利），见根 `LICENSE`。
- CI：`.github/workflows/ci.yml`，push main + PR 均跑 `npm ci` + `npm run verify`。
