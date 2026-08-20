# mise GUI — 设计方案（Draft v0.2，已并入 Review Round 1 决定，等待用户审批）

> 状态：设计大纲已按用户回复修订。本文件记录需求、决定、总体设计、开发流程与 CI/CD 构想。
> 参照来源：仅只读 ../DataGen/.github/workflows/ci.yml 与 release.yml（用户指定允许）；未参考其他外部资料；未触碰项目外任何文件。

---

## 0. Review Round 1 —— 决定记录

针对用户六条回复 + 一条能力验证要求，逐项决定如下：

| # | 用户意见 | 我的决定 | 理由 |
|---|---------|---------|------|
| 1 | 放 gui/（前端）与 server/（后端）；若独立做成 app 亦可；若前者 CI/CD 必须是"适配性增加"而非"app 式只管自己" | **in-repo：gui/ + server/**，架构上做成"可随时整体搬移到独立仓库 miseui"的产品级结构；CI/CD 按"适配性增加"设计 | ① 当前约束=不触碰项目外，in-repo 是唯一零外部足迹选项；② 在库内可直接针对本仓库的 mise 二进制联调与 E2E；③ 若日后 PR 不被采纳，`gui/`+`server/` 可原样搬进独立 miseui 仓库，零重构成本（命名已按产品级准备） |
| 2 | 框架由我定，选最方便维护、能快构建、匹配风格的 | **React 18 + TypeScript**（构建工具：Vite，包管理：**bun**） | 质感设计体系所依赖的组件/动画/数据层（Radix/shadcn 风格、Framer Motion、TanStack 生态）React 生态最成熟；我能最快构建与长期维护；bun 与宿主仓库现有 JS 工具链一致（仓库已有 bun.lock，适配性 +1） |
| 3 | 按 Material Design 3 理解，仅作灵感，可改，但必须保留"质感精髓" | 采纳。**MD3 为灵感来源**，§6.1 将"质感精髓"逐条具象化为可执行的铁律 | 质感精髓（不可妥协）：**分层深度与表面明度体系**、**柔和材料质感（渐变微光/细描边/毛玻璃）**、**物理感动效（spring/缓动）**、**克制而精致的排印与留白**、**语义色与状态反馈**。配色/圆角/密度可偏离 MD3 以适配 mise 品牌 |
| 4 | 接受中间件 Rust、默认端口 18771 | 确认：**server/ = Rust + axum**，默认 `127.0.0.1:18771`，全部可配置 | — |
| 5 | 独立仓库则命名 miseui；否则建 /gui 与 /server 并作为 PR；由我站在用户角度定 | **产品名统一为 MiseUI**（GUI 应用），中间件名 miseui-server；**本轮放在仓库内 `gui/` 与 `server/`**；未来若要独立则整体搬移为 miseui 仓库，命名不变 | 站在用户角度：先在本仓库低成本拿全部价值（含 PR 通路），保留独立产品后路；PR 价值不预设（诚实提示：是否被采纳取决于项目方，搬移后路已备好） |
| 6 | Web 版要做：可接入中间件访问任意远端 mise | **做**。同一套 React 应用：Tauri 壳 = 原生薄壳，网页端 = 同一应用静态托管；中间件升级为真正的"服务器"，支持**远端接入**（host/token/CORS，可反向代理加 TLS，提供 Docker 镜像），连接管理器 + 远端 URL/token 直连 | Web 版强调远程场景：mise 跑在哪台开发机，server 就装在哪台，网页/桌面任意连接 |
| 7 | CI/CD 位置取决于 1 与 5 | 仓库根 `.github/workflows/miseui-ci.yml` + `miseui-release.yml`；**适配性增加**：paths 过滤（仅 `gui/**`、`server/**` 变更时触发）、job 名 `miseui-*` 命名空间、沿用仓库既有 workflow 惯例（并发取消/action 版本），不改动 mise 自身构建，`server/` 作为**独立 cargo 工程（不加入 mise 的 workspace）** | 见 §8 |
| 8 | 验证目前是否有调用子 agent 进行视觉审查的能力（是否 MCP/skill 支持） | **已实测并打通**：mimo-v2.5 可用且具备图像输入（凭据见 §0.1） | 见 §0.1 |

## 0.1 视觉审查能力实测结果（对应要求 #8）

已在本会话实际执行验证，结论：

1. ✅ **子 agent 委托机制本身可用**：成功拉起子 agent，其可反射工具集（read/read_image/playwright MCP/dshdoc_extract 均声明存在）并执行任务返回结果。
2. ❌ **当前无可用的像素级视觉**：
   - 主 agent 模型（deepseek-v4-flash）**不声明图像输入**，`read_image` 对其不可用；
   - 默认子 agent 模型（glm-5.2）**同样不声明图像输入**，子 agent 实测 `read_image` 报错模型不支持图像；其诚实回答拒绝编造图像内容；
   - 本地文档引擎 **OCR 不可用**（`dshdoc_extract` 在 PNG 上 OCR 报"unavailable"）。
3. ✅ **结构化的"准视觉"审查路径可用（不依赖像素）**：
   - **Playwright MCP 在本会话可用**（已实测 navigate + snapshot + screenshot）：`browser_snapshot` 返回**无障碍文本树**（角色/标签/层级/文本），任意模型（含当前）都能据此审查界面结构与内容；
   - `browser_evaluate` 可做**客观设计断言**：检查 CSS 变量（设计令牌）、对比度、间距、布局盒、某个 token 是否生效、深色/浅色切换等；
   - `browser_take_screenshot` 能产出截图附件（可留档/给人类用户审阅；当前模型看不了像素原图）。
4. ⚠️ `subagent` 工具不暴露模型参数，默认子 agent 落在 **glm-5.2**（无图像输入）。
5. ✅ **已打通 mimo-v2.5 视觉通道**：DSH 配置 `~/.dsh/settings.yaml` 内置 `vision-router: { provider: opencode-go-vision, model: mimo-v2.5 }`；opencode（`~/.config/opencode/opencode.json`）在 `opencode-go` provider 下注册了 `mimo-v2.5` 与 `mimo-v2.5-pro`。实测：经 `workflow.agent({ provider: "opencode-go", model: "mimo-v2.5" })` 拉起子 agent，其 `read_image` 成功读取测试图并准确描述文字与色块——**像素级视觉可用**。
6. ✅ **Playwright MCP 亦可用**（navigate/snapshot/screenshot 实测通过）：`browser_snapshot` 无障碍文本树 + `browser_evaluate` 计算样式/令牌断言 + 截图供 mimo-v2.5 或人类审阅。
7. ✅ 会话技能目录无专门视觉 skill，但无需——mimo-v2.5 通道已验证。
8. **结论/路线**：真正「mimo-v2.5 子 agent 视觉审查闭环」**现已可用**：运行应用 → Playwright 截图 → mimo-v2.5 子 agent 美学评审 → 返工。结构化 QA（无障碍树 + 令牌断言）作为补充保留。

## 1. 需求记录（Requirements Record，增补后）

| # | 要求 | 确认 |
|---|------|------|
| R1–R12 | 同 v0.1（痛点/跨平台/质感设计大风格/主题小风格可调有默认/公开 CLI 优先/美观的环境变量呈现/doctor 设计/可配置中间件/视觉设计走子 agent/先大纲后后端再前端并反复测试最后 CI/只读参考 DataGen CI 且不碰项目外） | ✅ |
| R13 | Web 版：同一应用可在浏览器运行，可接入中间件访问**任意远端 mise** | ✅ 新增 |
| R14 | 每次审美/视觉决策调用子 agent（mimo v2.5）进行视觉审查——需先验证能力 | ✅ 已验证可用（见 §0.1），视觉闭环即刻激活 |

## 2. 目标与非目标

**目标**
- 跨平台桌面 GUI（Win/macOS/Linux）+ **浏览器 Web 版**，双端共享同一套 React 代码，核心场景为**环境变量管理**。
- UI 与 mise 解耦，仅通过 `miseui-server` 的 HTTP/WS API 通信；所有 mise 交互走公开 CLI。
- 中间件支持**远端接入**（网页连远程开发机上的 server → 任意远端 mise）。
- 完整的医生中心（doctor）、工具/任务/配置/设置管理页。
- CI/CD 以"适配性增加"方式并入宿主仓库（若在库内），或可整体搬移为独立仓库产物。

**非目标**
- 不改动 mise 本体构建/workspace（`server/` 不加入 cargo workspace，`gui/` 不用根 package.json/根 eslint 的约定，只新增）。
- 不直接调用 mise 内部 Rust 函数做桥接。
- 不把 MiseUI 做成"只管自己的隔离 app 构建"（第一条决定即已排除）。

## 3. 总体架构

```
            ┌─────────────── 浏览器（Web 版，任意机器）──────────────┐
            │   Vite 构建的静态应用（同一套 React 代码）             │
            │                                                       │
   ┌───────────────────┐          ┌────────────────────────┐  spawn  ┌──────────┐
   │ Tauri 壳（原生）   │          │  miseui-server         │  (argv) │ mise CLI │
   │ 内嵌同一 React 应用│ ◄──────► │  Rust + axum 中间件     │ ◄──────► │ (本机或   │
   └───────────────────┘  HTTP/WS  │  绑定 127.0.0.1       │          │  远端目录)│
              │ 默认会话          │  或 0.0.0.0(--host)     │          └──────────┘
              ▼                   │  token 鉴权 / CORS      │  可 Docker 部署
      可选外部 server             └────────────────────────┘
      （网页/桌面填 URL+token）
```

- **server/ 是唯一与 mise 对话的一方**：解析/规范化 CLI JSON 输出、缓存、错误归一化、WS 流式（任务/安装）。
- **Web 与桌面共用同一应用壳代码**：Tauri 壳提供窗口/菜单/托盘/开机自启等原生能力；浏览器版提供"连接管理"（server URL + token），用于访问**任意远端 mise**。
- **远程安全基线**：默认 `127.0.0.1`；非回环监听强制要求 token；支持 CORS 白名单；文档建议公网走 SSH 隧道或反向代理（如 caddy/nginx）加 TLS；提供 Docker 镜像便于部署在 mise 所在机器。

## 4. 技术选型（决定版）

| 层 | 选型 | 理由 |
|----|------|------|
| 前端 | **React 18 + TypeScript + Vite** | 决定见 §0-review#2；生态最利于质感体系与长期维护 |
| 包管理 | **bun** | 宿主仓库已用 bun（适配性 +1）；快 |
| UI/质感 | 自研设计令牌 + Tailwind + Radix 原语（shadcn 风格） | 保证"质感精髓"不被稀释 |
| 动画 | Framer Motion | 物理感动效；全局可关（prefers-reduced-motion + 设置项） |
| 数据层 | TanStack Query（轮询/失效）+ Zustand + WS | 服务端缓存失效与实时流配合 |
| 中间件 | **Rust + axum + tokio**（独立 cargo 工程，不加入 mise workspace） | 决定见 §0-review#4 |
| 测试 | cargo test + fake-mise 夹具；vitest + testing-library；HTTP 集成测试；Playwright(无障碍+计算样式断言) | 全链路离线可重复 + 无视觉模型期的准视觉 QA |
| Web 状态 | Web、桌面共享代码；`vite build` 产物可直接静态托管 | 决定见 §0-review#6 |

## 5. server/（中间件 miseui-server）设计

### 5.1 形态与配置（可配置性 = 硬需求 R8 + 远端 R13）
优先级：CLI 参数 > 环境变量 > 配置文件 > 默认值。

- CLI：`miseui-server --port 18771 --host 127.0.0.1 --mise-bin mise --config ~/.config/miseui/config.toml --token <t> --allow-origin https://ui.example.com --cache-ttl 5s --log-level info`
- 配置文件（TOML，默认路径 ~/.config/miseui/config.toml）：
```toml
port = 18771
host = "127.0.0.1"              # 0.0.0.0 支持远端（此时 token 必填）
mise_bin = "mise"               # 允许指向自定义 mise 二进制/脚本（含测试 fake-mise）
token = ""                      # 非空时要求 X-Miseui-Token 头；远端监听强制要求
allow_origins = []              # CORS 白名单（Web 版）
cache_ttl_secs = 5
log_level = "info"
```
- 环境变量：`MISEUI_PORT`、`MISEUI_HOST`、`MISEUI_MISE_BIN`、`MISEUI_TOKEN` 等。
- 启动输出一行 JSON（端口、mise 版本、鉴权开关），供 GUI 探测；提供 `/api/v1/health`。

### 5.2 mise 公开 CLI 清单（R5）
与 v0.1 §5.3 相同：`mise env --json-extended`（value+source/tool 归属）、`mise env -J`/`--redacted`、`mise doctor --json`、`mise config ls -J`、`mise tasks ls -J`/`mise run`、`mise settings ls/get/set/unset`、`mise plugins ls`、`mise ls/--json`、`mise ls-remote`、`mise use/install/uninstall/link/where`、`mise set/unset`（--file/--global/-E/--age-encrypt）、`mise trust/reshim/current/--version`。**绝不用 shell -c 拼命令；一律 argv spawn。**

### 5.3 API（/api/v1，含 Web 需要的远端形态）
沿用 v0.1 §5.4 全表（health/env/env/path/env/diff/env/set+unset/doctor/config/tools/tasks/settings/plugins/stream/openapi）。
远端补充：
- `GET /api/v1/about`：server 版本 + 可连接的 mise 版本/路径 + 鉴权状态（供连接管理器握手）；
- CORS：`allow_origins` 生效；WS 继承鉴权头（token 放 query 或 subprotocol，文档明示）。

### 5.4 健壮性与安全
- 超时/退出码 → 结构化错误 `{code, message, stderr_tail}`；响应缓存（TTL），写操作后按"配置→环境"失效。
- 长任务 WS 推流可取消；**fake-mise 夹具**（`--mise-bin` 指向测试脚本）→ 中间件与前端 CI 完全离线可测；
- 安全性：默认回环绑定；远端强制 token；argv spawn 无注入面；日志不落 token/密钥值；README 写明公网须经 SSH 隧道或反向代理+TLS。

### 5.5 部署形态
- 桌面默认：Tauri 启动时拉起本机 server（子进程，端口冲突则复用已运行的）；浏览器版：用户在"连接"页填 `ws/https://host:port + token`；
- Docker 镜像：`server/Dockerfile`（单二进制 + 自定义 `MISEUI_MISE_BIN` 挂载点），用于把 server 部署到任意远端开发机。

## 6. gui/（前端 MiseUI）设计

### 6.1 设计语言（大风格=质感设计；MD3 为灵感，非照搬）
**质感精髓铁律（不可妥协）**
1. **分层深度**：表面按 elevation 明度/阴影分层（背景<卡片<浮层），细描边勾勒层级；
2. **柔和材料**：渐变微光、backdrop-blur 毛玻璃、低饱和表面、feather 阴影，忌平实或生硬色块；
3. **物理动效**：Framer Motion spring（回弹/惯性），位移/淡入淡出，300ms 内；全局"减少动画"开关；
4. **克制排印**：字阶（display/title/body/label）+ 8pt 节奏 + 充足留白；语义色少而准（OK/警告/错误/信息）；
5. **状态即反馈**：悬停/焦点（光环）、选中、加载骨架、空态插画，处处有质感细节。
**可偏离 MD3 之处**：配色改用 mise 绿 #00a352 家族与品牌化强调色；圆角/密度按产品手感调整；去 Material 化的"臃肿"组件样式。
组件：`gui/src/ui/` 自研库（Button/Card/Chip/Badge/Dialog/Tooltip/Tree/Table/PathChain/Waterfall 等，基于 Radix）。
**视觉介入（§0.1）**：设计令牌与关键页面的视觉稿、以及运行中截图评审，走"mimo2.5/视觉模型子 agent"闭环；未启用前用结构化 QA 兜底。

### 6.2 主题系统（小风格）
- 注册表 `themes/`：每个主题 = 一组 CSS 变量（颜色/圆角/玻璃感/动效时长）。
- 默认：「Mise 质感」亮/暗双态（跟随系统或手动）。
- 可选：玻璃拟态深色 / 高对比极简 / MD3 动态取色（读系统强调色）。
- 持久化于 GUI 设置；切换零刷新（CSS 变量热替换）。

### 6.3 环境变量呈现机制（核心卖点 R6）
同 v0.1 §6.3，六件套：**解析瀑布（来源归属链）**、**PATH 可视化器**、**模板预览**、**环境对比 Diff**、**秘密处理**（redacted/age 加密）、**编辑闭环**（set/unset→缓存失效→即时刷新）。Web/桌面共用同一组件。

### 6.4 Doctor（健康中心，R7）
同 v0.1 §6.4：总览状态环 + 分类卡片 + 严重级驱动排序 + 修复提示（可复制命令）+ 复制完整报告 + 重新检测。返回数据为 `mise doctor --json` 规范化结构。

### 6.5 其他页面
Dashboard / Tools / Tasks / Config / Settings / **连接管理（Connect）**（Web 版核心：server URL+token 握手、最近连接、健康状态徽标）。

### 6.6 动画与可访问性
Framer Motion 页面转场/列表重排/diff 高亮/骨架屏；全应用尊重 prefers-reduced-motion；无障碍文本树 + 键盘可达为默认要求（也是无视觉模型期 QA 的依据）。

## 7. 开发流程（Phase 0 ✅ → Phase 1…，含视觉循环）

- **Phase 0（本文件）**：大纲与决定，等待用户审批。✅
- **Phase 1：server/（后端先行）**：Rust+axum 骨架 → mise 适配层（逐个公开 CLI）→ API → 缓存/WS/配置/鉴权 → Docker；TDD：单测 + fake-mise 集成测试 + 本机真实 mise 调试。
- **Phase 2：gui/（与 Phase 1 并行）**：脚手架（Tauri+Vite+React+bun）→ 设计令牌（质感铁律，视觉稿委托 mimo-v2.5 子 agent）→ ui/ 组件库 → 页面；**每个视觉决策与运行中截图都委托 mimo-v2.5 子 agent 评审**（经 `workflow.agent({ provider: "opencode-go", model: "mimo-v2.5" })` 通道实测可用）；辅以 `browser_snapshot` 无障碍树 + `browser_evaluate` 令牌断言。
- **Phase 3：集成与打磨**：Tauri 拉起/复用 server、Web 静态托管 + 远端连接实测（本机 server→浏览器）、两端联调、视觉终审。
- **Phase 4：CI/CD**（适配性增加，见 §8）。
- **Phase 5：文档**：gui/README、server/README（配置/安全/部署）。

## 8. CI/CD 设计（适配性增加，非 app 式 —— 对应决定 #1/#7）

**总原则（适配性增加）**
- **不触碰 mise 自身构建**：不修改根 Cargo.toml/Cargo.lock/deny.toml/根 package.json/根 eslint/hk；`server/` 是独立 cargo 工程，`gui/` 自带 package.json+bun.lock 于子目录。
- **paths 过滤**：CI 仅在 `gui/**`、`server/**` 变更的 push/PR 上运行，不拖慢与 GUI 无关的 mise PR。
- **命名与惯例**：job 名前缀 `miseui-`；并发 `concurrency` + `cancel-in-progress` 沿用仓库 workflow 惯例；action 版本与仓库一致（checkout@v4 等）。
- 若日后搬移为独立 miseui 仓库，同一 workflow 文件原样可用（路径/命名已产品化）。

**CI：`miseui-ci.yml`（push/PR + paths 过滤）**
1. `miseui-server` job：OS 矩阵（ubuntu/macos/windows × stable）——`cargo test` + `cargo clippy -- -D warnings` + Swatinem/rust-cache（key 含 miseui 前缀）；Linux 装 Tauri 依赖（libwebkit2gtk-4.1-dev 等，参照 DataGen）。
2. `miseui-web` job（ubuntu）：bun install（frozen-lockfile）→ lint → tsc typecheck → vitest（无测试则跳过，参照 DataGen 模式）。
3. `miseui-integration` job（ubuntu）：构建 server 二进制 → 以 fake-mise 为 `--mise-bin` 跑 API 集成测试（HTTP 断言 + 错误路径）→ `bun tauri build`（Linux）冒烟验证产物可产出。
4. `miseui-deb-smoke`（可选门禁，照 DataGen）：deb 构建 + dpkg-deb 元数据/结构校验 + lintian（errors fail）+ 安装/卸载冒烟。

**Release：`miseui-release.yml`（tag `miseui-v*` 手动或 tag 触发）**
- 版本一致性校验：tag 与 `server/Cargo.toml` 版本比对（照 DataGen 模式）。
- 产物矩阵：Linux deb（+lintian/install-uninstall 冒烟）、macOS app/dmg、Windows nsis、**Web 静态包**、**server Docker 镜像**（构建+健康检查验证后推送，照 DataGen build-web 的健康检查验证模式；Dockerfile badge 于 §5.5）。
- `actions/upload-artifact` + `softprops/action-gh-release` 聚合发布与自动 release notes。
- 与 mise 主仓库 release 分支完全隔离。

## 9. 测试策略
- server：单测（解析/规范化/缓存/鉴权）+ fake-mise 集成测试（全 API 含错误路径）+ 真实 mise 冒烟 + Docker 健康检查。
- gui：vitest 组件/状态测试；API 层对接 fake-mise 驱动的 server。
- 视觉/体验 QA（分两档）：① 结构化档（现可用）：Playwright 无障碍快照（子 agent 可评审）+ `browser_evaluate` 计算样式/令牌断言（对比度、间距、主题切换生效）+ 截图留档；② 视觉模型档（**已可用**）：mimo-v2.5 子 agent（经 workflow agent 覆盖通道）打开运行中的应用 → Playwright 截图 → 美学评审 → 返工循环（依据实测，可靠读取像素）。
- 手工验收：Win/macOS/Linux 至少一次真实场景走查 + Web 远端连接场景。

## 10. 里程碑
| M | 内容 | 出口标准 |
|---|------|---------|
| M1 | server v0.1（env/doctor/config/tools/tasks/settings/连接+配置+缓存+WS+鉴权） | 单测 + fake-mise 集成绿 |
| M2 | gui 骨架 + 主题系统 + Env 瀑布 v0.1（质感铁律落实 + 视觉评审通过） | vite dev 可浏览，结构化/视觉 QA 通过 |
| M3 | 全部页面 + 动画 + 编辑闭环 + 连接管理 | 全功能可用，Web/远端实测通过 |
| M4 | Tauri 打包 + Docker/Web 托管 | 三平台脚本 + 镜像可构建 |
| M5 | CI/CD（适配性）+ 文档 | miseui-ci 全绿，release 演练成功 |

## 11. 待确认 / 后续触发点（Open Items）
1. **存续形态**：本轮按"仓库内 gui/+server/"推进（决定）。何时搬移为独立 miseui 仓库、是否近期提 PR——由你决定，我按此调整 CI 文档与 README。
2. **视觉模型**：已确认 mimo-v2.5（opencode-go provider）在本会话可用且支持图像输入（§0.1 实测通过）——**视觉审查闭环生效**，即 §9②。
3. 首个可视化产物（M1/M2）出来后可先给你人工看一眼设计方向。
---
## 执行进度（2026-08-20，Round 2）

（用户已批准开工：mid执行，无需逐步汇报，遇重试3次以上故障调 glm-5.2 子代理，其仍不行则停下汇报。）

### 已完成
- **server/**：Rust+axum 中间件完整实现（配置/CLI/mise runner/API/WS/鉴权/CORS/缓存）；fake-mise 夹具 + **13/13 集成测试绿**（含错误路径、鉴权、缓存命中不重启）；Dockerfile、README。
- **gui/**：Vite+React+TS+bun；手写令牌系统（mimo v2.5 设计规范全量落地）+ 主题注册表（mise/glass-dark/hc/material-you + reduce-motion）；8 个页面（Env 瀑布/PATH/对比/Doctor/工具/任务/配置/设置/连接）；typecheck + vite build 通过。
- **M3 视觉闭环**：Playwright 截图 → mimo v2.5 三轮评审返工（8.5/10，全部修复确认生效）；评审记录见 gui/design/design-notes.md。
- **M5 CI/CD**：.github/workflows/miseui-ci.yml（paths 过滤自适应 integration）+ miseui-release.yml（tag 触发、版本校验、web+镜像+桌面）。
- 真实 mise 冒烟：本机 rustc 1.89 < 仓库 MSRV 1.93；已尝试 rustup 1.93 安装（进行中），成功则补冒烟。

### 进行中 / 待办
- **M4**：src-tauri（Tauri 2 壳 + 图标）已就位；Linux deb 编译冒烟执行中。
- 全量回归 + 三平台构建脚本；搬移为独立 miseui 仓库的说明（README 已含结构）。
