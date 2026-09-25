#Requires -Version 5.1
<#
  观梅 · Plumora —— 一键启动本地服务并打开浏览器

  用法（在 cmd 或 PowerShell 里都可以）：
    start.bat                启动开发服务器（默认，改代码即时生效）
    start.bat prod           构建生产版本并启动预览服务器
    start.bat help           查看帮助

  可选参数（直接调用本脚本时可用）：
    -Port <端口>             指定端口（默认 dev = 5173 / prod = 4173）
    -Timeout <次数>          等待服务就绪的最大探测次数（默认 45，每次约 1 秒）
    -NoOpen                  不自动打开浏览器

  关于「运行后端」：
    本项目是纯静态前端 —— 没有服务端程序，也不访问任何远端接口。
    这里说的「运行后端」= 启动本机的本地服务器：
      dev  模式 → Vite dev server（热更新，改代码即时生效）
      prod 模式 → 先 npm run build，再 Vite preview（跑真实产物）
    服务只监听 127.0.0.1，不对外开放。

  ⚠ 本文件必须保存为「UTF-8 with BOM」。
    Windows PowerShell 5.1 只在看到 BOM 时才按 UTF-8 解析脚本，
    否则会把中文按 ANSI（本机为 GBK）解码，中文提示全部变成乱码。
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Mode = 'dev',

    [int]$Port = 0,

    [int]$Timeout = 45,

    [switch]$NoOpen
)

$Root     = $PSScriptRoot
$BindHost = '127.0.0.1'
$AppName  = '观梅 · Plumora'

Set-Location -LiteralPath $Root

# ---------------------------------------------------------------- 小工具

function Write-Line {
    param([string]$Text = '', [string]$Color = 'Gray')
    Write-Host $Text -ForegroundColor $Color
}

function Stop-WithError {
    param([string]$Message)
    Write-Host ''
    Write-Host "  [错误] $Message" -ForegroundColor Red
    Write-Host ''
    exit 1
}

function Show-Usage {
    Write-Host ''
    Write-Host "  $AppName 一键启动脚本" -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  用法：' -ForegroundColor Gray
    Write-Host '    start.bat            启动开发服务器（默认，改代码即时生效）'
    Write-Host '    start.bat prod       构建生产版本并启动预览服务器'
    Write-Host '    start.bat help       显示本帮助'
    Write-Host ''
    Write-Host '  可选参数：' -ForegroundColor Gray
    Write-Host '    -Port <端口>         指定端口（默认 dev = 5173 / prod = 4173）'
    Write-Host '    -Timeout <次数>      等待服务就绪的最大探测次数（默认 45）'
    Write-Host '    -NoOpen              不自动打开浏览器'
    Write-Host ''
    Write-Host '  启动完成后会自动用默认浏览器打开页面。' -ForegroundColor Gray
    Write-Host ''
}

# 探测端口上跑的是不是本项目。
# 判定依据：本项目所有页面（dev 与 preview 都会注入）带 <meta name="app-version">，
# 见 apps/web/vite.config.ts 的 appVersionPlugin()。
# 返回 'ours'（本项目）/ 'foreign'（被别的程序占用）/ 'none'（没人监听）
function Test-PlumoraServer {
    param([string]$Url)
    try {
        $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($resp.Content -match 'app-version') { return 'ours' }
        return 'foreign'
    } catch {
        return 'none'
    }
}

# 调用 npm / vite。
# npm 与 vite 的输出是 UTF-8，而 Windows PowerShell 5.1 默认按控制台代码页
# （本机为 936 / GBK）解码子进程输出，会把 vite 的 ✓ │ ➜ 一类符号解成乱码。
# 这里只在调用期间临时把解码器切到 UTF-8，调用结束后立刻还原，
# 以免影响本脚本自己输出的中文。
function Invoke-Npm {
    # ⚠ 必须用 ValueFromRemainingArguments。
    #   普通 function 的 [string[]] 参数只吃「一个」位置参数，多余的会掉进 $args：
    #   Invoke-Npm run build 会变成 npm run（不带脚本名）——npm 只打印脚本清单并以 0 退出，
    #   于是构建被静默跳过、退出码还是 0，属于「假成功」。
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArgs)

    $savedEncoding = $null
    try { $savedEncoding = [Console]::OutputEncoding } catch { }

    try {
        [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
    } catch {
        # 某些无控制台环境（如输出被重定向）设置失败，退化为默认行为即可
    }

    try {
        # ⚠ 必须显式 Out-Host：否则 npm 的输出会和下面的返回值一起被调用方
        #   捕获（$code = Invoke-Npm ... 会把整段输出吞进 $code），
        #   既看不到构建日志，退出码比较也会因数组求值而误判为失败。
        & npm @NpmArgs | Out-Host
        $exitCode = $LASTEXITCODE
    } finally {
        if ($null -ne $savedEncoding) {
            try { [Console]::OutputEncoding = $savedEncoding } catch { }
        }
    }

    return $exitCode
}

# ---------------------------------------------------------------- 参数解析

$mode = $Mode.Trim().ToLowerInvariant()

if ($mode -in @('help', '-h', '--help', '/?', '-?')) {
    Show-Usage
    exit 0
}

if ($mode -eq 'dev') {
    $task        = 'dev'
    $label       = '开发'
    $defaultPort = 5173
    $needBuild   = $false
} elseif ($mode -eq 'prod') {
    $task        = 'preview'
    $label       = '生产预览'
    $defaultPort = 4173
    $needBuild   = $true
} else {
    Write-Host ''
    Write-Host "  [错误] 无法识别的参数：「$Mode」" -ForegroundColor Red
    Show-Usage
    exit 2
}

if ($Port -le 0) { $Port = $defaultPort }
$url = "http://${BindHost}:$Port/"

# 顺带把版本号显示出来，方便确认「浏览器里跑的是哪个版本」
$versionLabel = ''
$versionJson  = Join-Path $Root 'version.json'
if (Test-Path -LiteralPath $versionJson) {
    try {
        $meta = Get-Content -LiteralPath $versionJson -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($meta.version) { $versionLabel = " v$($meta.version)" }
    } catch {
        # 版本号只是装饰，读不出来不影响启动
    }
}

Write-Host ''
Write-Host ('=' * 60) -ForegroundColor DarkCyan
Write-Host "  $AppName$versionLabel   一键启动（$label 模式）" -ForegroundColor Cyan
Write-Host ('=' * 60) -ForegroundColor DarkCyan
Write-Host ''

# ---------------------------------------------------------------- 1/4 运行环境

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Stop-WithError '未找到 Node.js。本项目需要 Node.js 20.19 或更高版本。下载地址：https://nodejs.org/'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Stop-WithError '未找到 npm（通常随 Node.js 一起安装）。请重新安装 Node.js 并确保勾选「Add to PATH」。'
}

$nodeVersion = (& node --version) -join ''
Write-Host "  [1/4] 运行环境     Node.js $nodeVersion  [OK]" -ForegroundColor Green

# ---------------------------------------------------------------- 2/4 依赖

$viteMarker = Join-Path $Root 'node_modules\vite'
if (Test-Path -LiteralPath $viteMarker) {
    Write-Host '  [2/4] 依赖         已就绪  [OK]' -ForegroundColor Green
} else {
    Write-Host '  [2/4] 依赖         未安装，正在执行 npm install ...' -ForegroundColor Yellow
    Write-Host '                     （首次运行需要联网，可能要几分钟）' -ForegroundColor DarkGray
    $installCode = Invoke-Npm install
    if ($installCode -ne 0) {
        Stop-WithError 'npm install 失败。请检查网络连接后重试；若使用了代理，请先配置 npm 代理。'
    }
    Write-Host '  [2/4] 依赖         安装完成  [OK]' -ForegroundColor Green
}

# ---------------------------------------------------------------- 3/4 服务

$probe = Test-PlumoraServer -Url $url

if ($probe -eq 'ours') {
    Write-Host "  [3/4] 启动服务     端口 $Port 上已有本项目的服务在运行，跳过启动  [OK]" -ForegroundColor Green
} elseif ($probe -eq 'foreign') {
    Stop-WithError "端口 $Port 已被其它程序占用（探测到的内容不是本项目）。请关闭占用该端口的程序，或改用 -Port 指定其它端口。"
} else {
    if ($needBuild) {
        Write-Host '  [3/4] 构建         正在构建生产版本 ...' -ForegroundColor Yellow
        $buildCode = Invoke-Npm run build
        if ($buildCode -ne 0) {
            Stop-WithError '生产构建失败，请查看上方的构建错误输出。'
        }
        Write-Host '  [3/4] 构建         完成  [OK]' -ForegroundColor Green
    }

    Write-Host "  [3/4] 启动服务     端口 $Port，在新窗口中运行 ..." -ForegroundColor Yellow
    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList "/k npm run $task -w @plumora/web -- --port $Port --strictPort" `
        -WorkingDirectory $Root

    Write-Host "                     等待服务就绪（最多 $Timeout 次探测）..." -ForegroundColor DarkGray

    $ready = $false
    for ($i = 0; $i -lt $Timeout; $i++) {
        Start-Sleep -Milliseconds 900
        $again = Test-PlumoraServer -Url $url
        if ($again -eq 'ours') { $ready = $true; break }
        if ($again -eq 'foreign') {
            Stop-WithError "端口 $Port 被其它程序占用了，服务未能正常启动。"
        }
    }

    if (-not $ready) {
        Stop-WithError '等待服务就绪超时。请查看那个新开的命令行窗口里的报错信息。'
    }
}

# ---------------------------------------------------------------- 4/4 打开浏览器

if ($NoOpen) {
    Write-Host '  [4/4] 打开浏览器   已跳过（-NoOpen）' -ForegroundColor DarkGray
} else {
    Write-Host '  [4/4] 打开浏览器   正在打开默认浏览器 ...' -ForegroundColor Green
    Start-Process $url
}

Write-Host ''
Write-Host ('-' * 60) -ForegroundColor DarkCyan
Write-Host "  服务地址：$url"
Write-Host '  服务跑在另一个命令行窗口里，关闭那个窗口即可停止服务。'
Write-Host ('-' * 60) -ForegroundColor DarkCyan
Write-Host ''

exit 0
