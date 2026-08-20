# miseui-server

MiseUI 的中间件：一个可配置的 HTTP/WebSocket 桥，把 **mise 的公开 CLI** 以通用 JSON API 暴露给任意客户端（桌面 app / 浏览器远程访问）。

- 只调用 mise 公开 CLI（mise env --json-extended、mise doctor --json、mise config ls -J、mise tasks ls -J、mise ls --json、mise settings、mise set/unset、mise use/install 等），**绝不**调用内部函数，**绝不**拼 shell 字符串（一律 argv 数组 spawn）。
- 可配置：CLI 参数 > MISEUI_* 环境变量 > --config TOML 文件 > 默认值。
- 默认绑定 127.0.0.1:18771；--host 0.0.0.0 支持远端（强制要求 --token）；带 CORS 白名单；文档建议公网走 SSH 隧道/反向代理+TLS。
- --mise-bin 可指向任意 mise 二进制或测试夹具（如 tests/fake-mise.sh），让 CI 完全离线。

## 运行

    # 默认（本机）
    cargo run --release

    # 可配置
    miseui-server --port 18771 --host 127.0.0.1 --mise-bin mise --config ~/.config/miseui/config.toml

    # 测试用（临时端口，写 port 文件）
    miseui-server --port 0 --port-file /tmp/miseui.port --mise-bin my-mise

配置示例 config.toml：

    port = 18771
    host = "127.0.0.1"
    mise_bin = "mise"
    token = ""            # 远端监听必填
    allow_origins = []    # CORS 白名单（Web 版）
    cache_ttl_secs = 5
    log_level = "info"

## API（/api/v1）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/health | 服务状态 + mise 版本 + 鉴权开关 |
| GET | /api/v1/about | 服务/mise 二进制/版本 |
| GET | /api/v1/env?cwd=&env=&redacted= | 环境变量解析（来源归属 + 工具注入标注） |
| GET | /api/v1/env/path?cwd= | PATH 分段 + 缺失/重复/shim 分析 |
| GET | /api/v1/env/diff?a_cwd=&a_env=&b_cwd=&b_env= | 两个上下文环境对比 |
| POST | /api/v1/env/set | mise set KEY=VAL（目标选择） |
| POST | /api/v1/env/unset | mise unset KEY |
| GET | /api/v1/doctor | mise doctor --json 规范化 |
| GET | /api/v1/config · /api/v1/config/raw?file= | 配置清单 / 安全只读（白名单） |
| GET | /api/v1/tools · /tools/versions · POST /tools/install · /tools/use | 工具管理 |
| GET | /api/v1/tasks · WS /api/v1/stream | 任务列表 / 运行并流式输出 |
| GET/POST | /api/v1/settings | 设置读写 |
| GET | /api/v1/plugins | 插件列表 |

鉴权：X-Miseui-Token 请求头（或 ?token=）。/api/v1/health 始终放行。

## 测试

    cargo test          # 单元 + 集成（基于 tests/fake-mise.sh 夹具，离线）

集成测试会为每个用例启动一个真实 server（--port 0 --port-file），以 fake-mise 作为 --mise-bin 断言各端点与缓存行为（含错误路径、鉴权）。
