# 观梅 · Plumora

梅花易数起卦与排盘工具。以传统梅花易数规则起卦、排盘、查阅卦象知识，并保存卦例以便复盘验证。

定位为**传统文化学习工具**：只呈现传统文献内容与规则推导结果，不生成预测性结论文案。

## 当前状态

- **Web 端**：已实现（Vue 3 + TypeScript + Vite，桌面与移动端自适应）
- **Android 端**：待排期（Kotlin + Jetpack Compose）
- **知识库**：卦辞爻辞 450 条 + 三传 130 条 + 十翼 5 章 = 585 条原文已入库（维基文库《周易正義》简体交付层），结果页支持卦级原文聚合展示（卦辞 / 爻辞 / 用九 + 彖 / 大象 / 小象 / 文言），学习页支持十翼原文全文浏览

两端共用同一套起卦算法口径与卦象知识库数据，仅在平台能力（日历转换、持久化、UI 渲染）上各自实现。

## 功能

| 模块 | 内容 |
| --- | --- |
| 起卦 | 时间、数字、汉字笔画、随机，共四种方式 |
| 排盘 | 本卦、互卦、变卦、动爻、体卦/用卦、五行生克结论（大吉/小吉/吉/小凶/大凶） |
| 卦例 | 本地保存、备注、应验标记、列表、关键字搜索、导出 JSON / CSV |
| 学习 | 八卦类象速查、六十四卦速查 |
| 设置 | 笔画标准（简/繁）、默认起卦方式、体用判定流派、主题、保留记录上限 |

全部功能离线可用，数据仅存本机，不发任何网络请求。

## 快速开始

### 一键启动（推荐）

在**仓根**双击 `start.bat`，或在 cmd / PowerShell 里执行：

```bat
start.bat             :: 启动开发服务器（默认，改代码即时生效）
start.bat prod        :: 构建生产版本并启动预览服务器
start.bat help        :: 查看帮助
```

脚本会自动检查 Node 环境与依赖（首次运行自动 `npm install`）、在端口被占用时给出明确提示、等服务真正就绪后再用默认浏览器打开页面。

> 本项目是**纯静态前端**，没有服务端程序。所谓「运行后端」= 启动本机本地服务器（dev 用 Vite dev server，prod 先 build 再 `vite preview`），只监听 `127.0.0.1`，不对外开放。

### 手动命令

```bash
npm install          # 安装全部 workspace 依赖
npm run dev          # 启动 Web 端开发服务器
npm run build        # 生产构建（产物 apps/web/dist，纯静态）
npm run verify       # 版本一致性 + 类型检查 + 全量单测 + 运行时冒烟 + 生产构建（提交前必跑）
```

## 在线访问（GitHub Pages）

Web 端为纯静态产物，可直接部署到 GitHub Pages。仓库已内置自动发布工作流 [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)：推送到 `main`（或手动触发 workflow）即自动构建并上线，无需把构建产物提交进仓库。

首次使用前需**启用一次 Pages**（前提：仓库为**公开**，GitHub Free 账户的私有仓库不支持）：

- 方式一（网页）：仓库 **Settings → Pages → Build and deployment**，把 **Source** 选为 **GitHub Actions** 并保存；
- 方式二（命令行）：`gh api -X POST repos/<你的用户名>/Plumora/pages -f build_type=workflow`。

> 工作流的 `configure-pages` 带 `enablement: true`，但 GITHUB_TOKEN **没有**新建 Pages site 的权限，故首次启用必须手动完成一次；启用后它仅作无害的 no-op。

启用后推送 `main` 即自动构建上线，等待 1–5 分钟，即可通过以下地址访问：

```
https://<用户名>.github.io/Plumora/
```

> - 站点地址中的仓库名按实际大小写；应用为 hash 路由 + 相对路径资源，子路径部署无需任何额外配置，页面本身仍保持离线可用、不发网络请求。

## 版本管理

Web 端与 Android 端**共用同一版本号**，真源为仓根 [`version.json`](version.json)。

```bash
npm run version:show         # 查看当前版本与全部派生目标状态
npm run version:bump:patch   # 升版本（自动同步 + 插入 CHANGELOG 条目）
npm run version:check        # 校验派生目标是否与真源一致（已接入 npm run verify）
```

派生目标：5 个 workspace 的 `package.json`、`apps/web/src/generated/version.ts`、Android `versionName`/`versionCode`（`apps/android/` 建立后自动接管）。**这些文件不要手工编辑**——`version:check` 会逐字节比对并拦下漂移。

产品版本变更记在 [`CHANGELOG.md`](CHANGELOG.md)；设计文档另有独立的文档版本体系，见 [docs/dev/README.md](docs/dev/README.md) §四。

## 目录结构

```
Plumora/
├─ start.bat               # 一键启动（纯 ASCII 启动壳，见下方说明）
├─ start.ps1               # 一键启动的实际逻辑（UTF-8 with BOM）
├─ version.json            # 版本号单一真源（Web + Android 共用）
├─ CHANGELOG.md            # 产品版本变更记录
├─ .github/workflows/      # CI 门禁（ci.yml）+ GitHub Pages 自动发布（deploy-pages.yml）
├─ package.json            # npm workspaces 根（packages/*、apps/*）
├─ tsconfig.base.json      # 全仓 TS 基线
├─ scripts/version.mjs     # 版本号同步 / 校验 / 升版本脚本
├─ packages/
│  ├─ knowledge/           # 卦象知识库（64 卦 / 8 卦类象 / 笔画表，纯数据，零依赖）
│  ├─ core/                # 起卦、卦象推导、五行生克、记录模型（纯逻辑）
│  └─ lunar/               # 农历转换适配（注入 core 定义的 LunarProvider 端口）
├─ apps/
│  └─ web/                 # Web 应用（Vue 3 + Vite）
│     └─ public/           # 品牌图标（印章 icon.svg / 纯字标 mark.svg，均为竖排小篆「觀梅」）
├─ docs/                   # 设计文档（dev/ 为九份主文档）
└─ .workbuddy/checks/      # 文档集自查脚本
```

### 为什么 `start.bat` 只是个启动壳

`cmd.exe` 会用**当前控制台代码页**解析整个批处理文件，所以含中文的 UTF-8 `.bat` 会被按 GBK 截成乱码命令（实测：改成 GBK 编码能用，但用户一旦开启 Windows 的 UTF-8 控制台选项就再次失效）。因此：

- `start.bat` 保持**纯 ASCII**，只负责找到 PowerShell 并把参数转交出去 —— 与代码页无关，且在 cmd / PowerShell 下都能双击或直接运行；
- 全部中文提示与逻辑放在 `start.ps1`，保存为 **UTF-8 with BOM**（Windows PowerShell 5.1 只在看到 BOM 时才按 UTF-8 解析脚本）。

`.gitattributes` 对 `*.bat` / `*.cmd` / `*.ps1` 显式锁定 `eol=crlf`：LF-only 的批处理文件会让 `goto` / 标签解析出错，不能跟随 `* text=auto`。

## 文档

设计与需求文档见 [docs/dev/README.md](docs/dev/README.md)（含阅读顺序与文档清单）；文档的契约范围（哪份是权威、`*.docx` 只是导出快照）见 [docs/README.md](docs/README.md)。

⚠️ 仓根 `package.json` 不设 `"type": "module"`——各 workspace 包自带该字段；仓根若设，会把 `.workbuddy/checks/*.js` 这些既有 CommonJS 工具链当成 ESM，导致检查脚本无法运行。

## 声明

本工具仅供传统文化学习与研究使用。

### 版权

**Copyright © 2026 hxzhang2000. All Rights Reserved.**

本项目**未**附开源许可证，即默认**保留全部权利**（no license granted）。源码公开可见，但不授予任何复制、修改、分发、再许可或商用的许可；如需使用请联系作者。见 [LICENSE](LICENSE)（占位声明，非开源许可）。

第三方依赖各自遵循其原有许可证（如农历转换所用 solarlunar 为 MIT），详见各依赖自身的许可声明。
