use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::{Query, State};
use axum::http::{HeaderValue, Method, StatusCode};
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::Mutex;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

use crate::config::Config;
use crate::mise::Mise;
use crate::models::{err_resp, ok, ApiResult, EnvVariable};

pub const READ: Duration = Duration::from_secs(40);
pub const HEAVY: Duration = Duration::from_secs(180);
pub const LSREMOTE: Duration = Duration::from_secs(120);

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<Config>,
    pub mise: Mise,
    pub cache: Arc<Mutex<HashMap<String, (Instant, Value)>>>,
}

impl AppState {
    pub fn new(cfg: Arc<Config>) -> Self {
        Self {
            mise: Mise::new(cfg.mise_bin.clone()),
            cfg,
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn cached<F, Fut>(&self, key: String, ttl: Duration, compute: F) -> Result<Value, String>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<Value, String>>,
    {
        {
            let m = self.cache.lock().await;
            if let Some((t, v)) = m.get(&key) {
                if t.elapsed() < ttl {
                    return Ok(v.clone());
                }
            }
        }
        let v = compute().await?;
        let mut m = self.cache.lock().await;
        m.retain(|_, (t, _)| t.elapsed() < ttl);
        m.insert(key, (Instant::now(), v.clone()));
        Ok(v)
    }

    pub async fn invalidate(&self) {
        self.cache.lock().await.clear();
    }

    pub async fn version(&self) -> Option<String> {
        self.mise
            .run(&["--version".to_string()], None, &[], READ)
            .await
            .ok()
            .and_then(|o| o.stdout.lines().next().map(|s| s.trim().to_string()))
    }
}

fn qs(q: &HashMap<String, String>, k: &str) -> Option<String> {
    q.get(k).cloned().filter(|s| !s.is_empty())
}

fn truthy(v: Option<&String>) -> bool {
    matches!(v, Some(s) if s == "true" || s == "1")
}

pub fn router(state: AppState) -> Router {
    let cfg = state.cfg.clone();
    let cors = build_cors(&cfg.allow_origins);
    Router::new()
        .route("/", get(root))
        .route("/api/v1/health", get(health))
        .route("/api/v1/about", get(about))
        .route("/api/v1/env", get(env_get))
        .route("/api/v1/env/path", get(env_path))
        .route("/api/v1/env/diff", get(env_diff))
        .route("/api/v1/env/set", post(env_set))
        .route("/api/v1/env/unset", post(env_unset))
        .route("/api/v1/doctor", get(doctor))
        .route("/api/v1/config", get(config_list))
        .route("/api/v1/config/raw", get(config_raw))
        .route("/api/v1/config/open", post(config_open))
        .route("/api/v1/tools", get(tools_list))
        .route("/api/v1/tools/versions", get(tools_versions))
        .route("/api/v1/tools/install", post(tools_install))
        .route("/api/v1/tools/use", post(tools_use))
        .route("/api/v1/tasks", get(tasks_list))
        .route("/api/v1/stream", get(crate::ws::stream_ws))
        .route("/api/v1/settings", get(settings_list).post(settings_set))
        .route("/api/v1/plugins", get(plugins_list))
        .fallback(not_found)
        .layer(middleware::from_fn_with_state(state.clone(), auth))
        .layer(cors)
        .with_state(state)
}

fn build_cors(origins: &[String]) -> CorsLayer {
    let methods = [Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS];
    let base = CorsLayer::new().allow_methods(methods).allow_headers(Any);
    if origins.is_empty() {
        base.allow_origin(Any)
    } else {
        let list = origins
            .iter()
            .filter_map(|o| o.parse::<HeaderValue>().ok())
            .collect::<Vec<_>>();
        base.allow_origin(AllowOrigin::list(list))
    }
}

async fn auth(
    State(st): State<AppState>,
    req: axum::extract::Request,
    next: middleware::Next,
) -> axum::response::Response {
    let path = req.uri().path().to_string();
    let required = !st.cfg.token.is_empty() && path != "/api/v1/health";
    if required {
        let header_ok = req
            .headers()
            .get("x-miseui-token")
            .and_then(|v| v.to_str().ok())
            .map(|v| v == st.cfg.token)
            .unwrap_or(false);
        let query_ok = req
            .uri()
            .query()
            .unwrap_or("")
            .split('&')
            .filter_map(|p| p.split_once('='))
            .any(|(k, v)| k == "token" && v == st.cfg.token);
        if !header_ok && !query_ok {
            return err_resp(StatusCode::UNAUTHORIZED, "unauthorized", "missing or invalid token".to_string())
                .into_response();
        }
    }
    next.run(req).await
}

async fn root() -> ApiResult {
    ok(json!({
        "service": "miseui-server",
        "api": "/api/v1"
    }))
}

async fn not_found() -> ApiResult {
    err_resp(StatusCode::NOT_FOUND, "not_found", "unknown endpoint".to_string())
}

async fn health(State(st): State<AppState>) -> ApiResult {
    let mise = st.version().await;
    ok(json!({
        "status": "ok",
        "service": "miseui-server",
        "version": env!("CARGO_PKG_VERSION"),
        "mise": mise,
        "auth": !st.cfg.token.is_empty()
    }))
}

async fn about(State(st): State<AppState>) -> ApiResult {
    let mise = st.version().await;
    ok(json!({
        "service": "miseui-server",
        "version": env!("CARGO_PKG_VERSION"),
        "mise_bin": st.cfg.mise_bin.display().to_string(),
        "mise_version": mise,
        "auth": !st.cfg.token.is_empty()
    }))
}

fn parse_env_json(v: Value) -> Vec<EnvVariable> {
    let mut vars = Vec::new();
    if let Some(map) = v.as_object() {
        for (k, val) in map {
            let o = val.as_object().cloned().unwrap_or_default();
            let get = |key: &str| o.get(key).and_then(|x| x.as_str()).map(|s| s.to_string());
            vars.push(EnvVariable {
                key: k.clone(),
                value: get("value").unwrap_or_default(),
                source: get("source"),
                tool: get("tool"),
                raw: get("raw"),
            });
        }
    }
    vars.sort_by(|a, b| a.key.cmp(&b.key));
    vars
}

async fn env_get(State(st): State<AppState>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let cwd = qs(&q, "cwd");
    let env_name = qs(&q, "env");
    let redacted = truthy(q.get("redacted"));
    let ttl = Duration::from_secs(st.cfg.cache_ttl_secs);
    let key = format!(
        "env|{}|{}|{}",
        cwd.clone().unwrap_or_default(),
        env_name.clone().unwrap_or_default(),
        redacted
    );
    let st2 = st.clone();
    let cwd_for = cwd.clone();
    let env_for = env_name.clone();
    let result = st
        .cached(key, ttl, move || async move {
            let mut args = vec!["env".to_string()];
            if redacted {
                args.push("--redacted".to_string());
            }
            args.push("--json-extended".to_string());
            let extra = crate::mise::env_extra(env_for.as_deref());
            let v = st2
                .mise
                .run_json(&args, cwd_for.as_deref(), &extra, READ)
                .await
                .map_err(|e| e.to_string())?;
            Ok(v)
        })
        .await;
    match result {
        Ok(v) => {
            let vars = parse_env_json(v);
            ok(json!({"ok": true, "cwd": cwd.unwrap_or_default(), "env_name": env_name, "vars": vars}))
        }
        Err(e) => err_resp(StatusCode::BAD_GATEWAY, "mise_env_failed", e),
    }
}

async fn env_path(State(st): State<AppState>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let cwd = qs(&q, "cwd");
    let env_name = qs(&q, "env");
    let ttl = Duration::from_secs(st.cfg.cache_ttl_secs);
    let key = format!("envpath|{}|{}", cwd.clone().unwrap_or_default(), env_name.clone().unwrap_or_default());
    let st2 = st.clone();
    let cwd_for = cwd.clone();
    let env_for = env_name.clone();
    let result = st
        .cached(key, ttl, move || async move {
            let extra = crate::mise::env_extra(env_for.as_deref());
            let v = st2
                .mise
                .run_json(&["env".to_string(), "--json-extended".to_string()], cwd_for.as_deref(), &extra, READ)
                .await
                .map_err(|e| e.to_string())?;
            let path = v
                .get("PATH")
                .and_then(|p| p.get("value"))
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let sep = if std::env::consts::OS == "windows" { ";" } else { ":" };
            let mut seen: HashSet<String> = HashSet::new();
            let mut entries = Vec::new();
            for (i, seg) in path.split(sep).enumerate() {
                if seg.is_empty() {
                    continue;
                }
                let p = std::path::Path::new(seg);
                let missing = !p.exists();
                let duplicate = seen.contains(seg);
                if !duplicate {
                    seen.insert(seg.to_string());
                }
                let is_shim = p.file_name().map(|n| n == "shims").unwrap_or(false);
                entries.push(json!({"index": i, "path": seg, "missing": missing, "duplicate": duplicate, "is_shim": is_shim}));
            }
            Ok(Value::Array(entries))
        })
        .await;
    match result {
        Ok(entries) => ok(json!({"ok": true, "cwd": cwd.unwrap_or_default(), "env_name": env_name, "entries": entries})),
        Err(e) => err_resp(StatusCode::BAD_GATEWAY, "mise_env_failed", e),
    }
}

async fn snapshot(st: &AppState, cwd: Option<String>, env_name: Option<String>) -> Result<Vec<EnvVariable>, String> {
    let extra = crate::mise::env_extra(env_name.as_deref());
    let v = st
        .mise
        .run_json(
            &["env".to_string(), "--json-extended".to_string()],
            cwd.as_deref(),
            &extra,
            READ,
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(parse_env_json(v))
}

async fn env_diff(State(st): State<AppState>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let a_cwd = qs(&q, "a_cwd");
    let a_env = qs(&q, "a_env");
    let b_cwd = qs(&q, "b_cwd");
    let b_env = qs(&q, "b_env");
    let (a, b) = tokio::join!(
        snapshot(&st, a_cwd.clone(), a_env.clone()),
        snapshot(&st, b_cwd.clone(), b_env.clone())
    );
    let (a, b) = match (a, b) {
        (Ok(a), Ok(b)) => (a, b),
        (Err(e), _) | (_, Err(e)) => return err_resp(StatusCode::BAD_GATEWAY, "env_failed", e),
    };
    let to_map = |v: Vec<EnvVariable>| -> HashMap<String, EnvVariable> { v.into_iter().map(|e| (e.key.clone(), e)).collect() };
    let am = to_map(a);
    let bm = to_map(b);
    let mut keys: Vec<String> = am.keys().cloned().collect();
    for k in bm.keys() {
        if !keys.contains(k) {
            keys.push(k.clone());
        }
    }
    keys.sort();
    let diffs: Vec<Value> = keys
        .into_iter()
        .filter_map(|k| {
            let av = am.get(&k);
            let bv = bm.get(&k);
            let state = match (&av, &bv) {
                (Some(x), Some(y)) if x.value == y.value => return None,
                (None, Some(_)) => "added".to_string(),
                (Some(_), None) => "removed".to_string(),
                _ => "changed".to_string(),
            };
            Some(json!({
                "key": k,
                "state": state,
                "a_value": av.map(|x| x.value.clone()),
                "b_value": bv.map(|x| x.value.clone()),
                "a_source": av.and_then(|x| x.source.clone()),
                "b_source": bv.and_then(|x| x.source.clone()),
            }))
        })
        .collect();
    ok(json!({
        "ok": true,
        "a": {"cwd": a_cwd, "env": a_env},
        "b": {"cwd": b_cwd, "env": b_env},
        "diff": diffs
    }))
}

#[derive(Deserialize)]
struct SetReq {
    key: String,
    value: String,
    cwd: Option<String>,
    file: Option<String>,
    #[serde(default)]
    global: bool,
    env: Option<String>,
}

async fn env_set(State(st): State<AppState>, Json(req): Json<SetReq>) -> ApiResult {
    if req.key.is_empty() {
        return err_resp(StatusCode::BAD_REQUEST, "bad_request", "key must not be empty".to_string());
    }
    let mut args = vec!["set".to_string(), format!("{}={}", req.key, req.value)];
    if req.global {
        args.push("-g".to_string());
    } else if let Some(f) = &req.file {
        args.push("--file".to_string());
        args.push(f.clone());
    } else if let Some(e) = &req.env {
        args.push("-E".to_string());
        args.push(e.clone());
    }
    st.invalidate().await;
    let out = match st.mise.run(&args, req.cwd.as_deref(), &[], HEAVY).await {
        Ok(o) => o,
        Err(e) => return err_resp(StatusCode::BAD_GATEWAY, "mise_set_failed", e.to_string()),
    };
    finish_write(out.exit_code, "mise_set_failed", out.stdout, out.stderr, json!({"key": req.key}))
}

#[derive(Deserialize)]
struct UnsetReq {
    key: String,
    cwd: Option<String>,
    file: Option<String>,
    #[serde(default)]
    global: bool,
}

async fn env_unset(State(st): State<AppState>, Json(req): Json<UnsetReq>) -> ApiResult {
    if req.key.is_empty() {
        return err_resp(StatusCode::BAD_REQUEST, "bad_request", "key must not be empty".to_string());
    }
    let mut args = vec!["unset".to_string(), req.key.clone()];
    if req.global {
        args.push("-g".to_string());
    } else if let Some(f) = &req.file {
        args.push("--file".to_string());
        args.push(f.clone());
    }
    st.invalidate().await;
    let out = match st.mise.run(&args, req.cwd.as_deref(), &[], HEAVY).await {
        Ok(o) => o,
        Err(e) => return err_resp(StatusCode::BAD_GATEWAY, "mise_unset_failed", e.to_string()),
    };
    finish_write(out.exit_code, "mise_unset_failed", out.stdout, out.stderr, json!({"key": req.key}))
}

fn finish_write(exit: i32, code: &str, stdout: String, stderr: String, extra: Value) -> ApiResult {
    if exit == 0 {
        ok(json!({"ok": true, "exit_code": 0, "output": stdout, "stderr": stderr, "detail": extra}))
    } else {
        err_resp(StatusCode::BAD_GATEWAY, code, format!("mise exited {exit}: {}", stderr.trim()))
    }
}

async fn doctor(State(st): State<AppState>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let cwd = qs(&q, "cwd");
    let ttl = Duration::from_secs(st.cfg.cache_ttl_secs);
    let key = format!("doctor|{}", cwd.clone().unwrap_or_default());
    let st2 = st.clone();
    let cwd_for = cwd.clone();
    let result = st
        .cached(key, ttl, move || async move {
            let out = st2
                .mise
                .run(&["doctor".to_string(), "--json".to_string()], cwd_for.as_deref(), &[], READ)
                .await
                .map_err(|e| e.to_string())?;
            let data: Value = if out.stdout.trim().is_empty() {
                json!({"raw": out.stderr})
            } else {
                serde_json::from_str(&out.stdout).unwrap_or_else(|_| json!({"raw": out.stdout}))
            };
            Ok(json!({"exit_code": out.exit_code, "data": data}))
        })
        .await;
    match result {
        Ok(v) => ok(v),
        Err(e) => err_resp(StatusCode::BAD_GATEWAY, "doctor_failed", e),
    }
}

async fn config_list(State(st): State<AppState>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let cwd = qs(&q, "cwd");
    let ttl = Duration::from_secs(st.cfg.cache_ttl_secs);
    let key = format!("config|{}", cwd.clone().unwrap_or_default());
    let st2 = st.clone();
    let cwd_for = cwd.clone();
    let result = st
        .cached(key, ttl, move || async move {
            st2.mise
                .run_json(&["config".to_string(), "ls".to_string(), "-J".to_string()], cwd_for.as_deref(), &[], READ)
                .await
                .map_err(|e| e.to_string())
        })
        .await;
    match result {
        Ok(v) => ok(json!({"ok": true, "cwd": cwd.unwrap_or_default(), "configs": v})),
        Err(e) => err_resp(StatusCode::BAD_GATEWAY, "config_failed", e),
    }
}

async fn config_raw(State(st): State<AppState>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let cwd = qs(&q, "cwd");
    let file = match qs(&q, "file") {
        Some(f) => f,
        None => return err_resp(StatusCode::BAD_REQUEST, "bad_request", "?file= is required".to_string()),
    };
    let allowed = config_allowed_paths(&st, cwd.as_deref()).await;
    if !allowed.contains(&file) {
        return err_resp(StatusCode::FORBIDDEN, "file_not_allowed", format!("reading {file} is not allowed"));
    }
    match tokio::fs::read_to_string(&file).await {
        Ok(text) => ok(json!({"ok": true, "file": file, "content": text})),
        Err(e) => err_resp(StatusCode::NOT_FOUND, "file_unreadable", e.to_string()),
    }
}

/// Open a config file in the machine's default editor (supports "external open"
/// from the GUI). Guarded by the same allowlist as config_raw so arbitrary file
/// reads/launches are not possible.
#[derive(Deserialize)]
struct OpenFileReq {
    file: String,
    cwd: Option<String>,
}

async fn config_open(State(st): State<AppState>, Json(req): Json<OpenFileReq>) -> ApiResult {
    let allowed = config_allowed_paths(&st, req.cwd.as_deref()).await;
    if !allowed.contains(&req.file) {
        return err_resp(StatusCode::FORBIDDEN, "file_not_allowed", format!("opening {file} is not allowed", file = req.file));
    }
    let opened_via = open_with_os(&req.file).await;
    ok(json!({"ok": true, "file": req.file, "opened_via": opened_via}))
}

async fn open_with_os(file: &str) -> String {
    if cfg!(windows) {
        let _ = tokio::process::Command::new("cmd").args(["/C", "start", "", file]).spawn();
        "cmd start".to_string()
    } else if cfg!(target_os = "macos") {
        let _ = tokio::process::Command::new("open").arg(file).spawn();
        "open".to_string()
    } else {
        let _ = tokio::process::Command::new("xdg-open").arg(file).spawn();
        "xdg-open".to_string()
    }
}

async fn config_allowed_paths(st: &AppState, cwd: Option<&str>) -> HashSet<String> {
    let mut set = HashSet::new();
    if let Ok(v) = st
        .mise
        .run_json(&["config".to_string(), "ls".to_string(), "-J".to_string()], cwd, &[], READ)
        .await
    {
        if let Some(a) = v.as_array() {
            for item in a {
                if let Some(p) = item.get("path").and_then(|x| x.as_str()) {
                    set.insert(p.to_string());
                }
            }
        }
    }
    if let Ok(v) = st
        .mise
        .run_json(&["env".to_string(), "--json-extended".to_string()], cwd, &[], READ)
        .await
    {
        if let Some(o) = v.as_object() {
            for val in o.values() {
                if let Some(s) = val.get("source").and_then(|x| x.as_str()) {
                    set.insert(s.to_string());
                }
            }
        }
    }
    set
}

/// Normalize `mise ls --json` output into a flat array. Real mise returns an
/// object keyed by tool name (each value a list of version entries); older/other
/// forms may be a plain array. A stable array contract keeps the UI simple.
fn normalize_tools(v: Value) -> Value {
    let items = match v {
        Value::Array(arr) => arr,
        Value::Object(map) => {
            let mut out: Vec<Value> = Vec::new();
            for (name, val) in map {
                let versions = match val {
                    Value::Array(versions) if !versions.is_empty() => versions,
                    Value::Array(_) => continue,
                    other => vec![other],
                };
                for ver in versions {
                    let mut obj = match ver {
                        Value::Object(o) => o,
                        other => {
                            let mut m = serde_json::Map::new();
                            m.insert("version".to_string(), other);
                            m
                        }
                    };
                    obj.insert("name".to_string(), json!(name));
                    if let Some(src) = obj.get("source").cloned() {
                        let s = src
                            .as_object()
                            .and_then(|m| m.get("path").or_else(|| m.get("type")))
                            .cloned()
                            .unwrap_or(src);
                        obj.insert("source".to_string(), s);
                    }
                    out.push(Value::Object(obj));
                }
            }
            out
        }
        _ => Vec::new(),
    };
    Value::Array(items)
}

async fn tools_list(State(st): State<AppState>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let cwd = qs(&q, "cwd");
    let ttl = Duration::from_secs(st.cfg.cache_ttl_secs);
    let key = format!("tools|{}", cwd.clone().unwrap_or_default());
    let st2 = st.clone();
    let cwd_for = cwd.clone();
    let result = st
        .cached(key, ttl, move || async move {
            let raw = st2
                .mise
                .run_json(&["ls".to_string(), "--json".to_string()], cwd_for.as_deref(), &[], READ)
                .await
                .map_err(|e| e.to_string())?;
            Ok(normalize_tools(raw))
        })
        .await;
    match result {
        Ok(v) => ok(json!({"ok": true, "cwd": cwd.unwrap_or_default(), "tools": v})),
        Err(e) => err_resp(StatusCode::BAD_GATEWAY, "tools_failed", e),
    }
}

async fn tools_versions(State(st): State<AppState>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let tool = match qs(&q, "tool") {
        Some(t) => t,
        None => return err_resp(StatusCode::BAD_REQUEST, "bad_request", "?tool= is required".to_string()),
    };
    let ttl = Duration::from_secs(st.cfg.cache_ttl_secs);
    let key = format!("lsremote|{}", tool);
    let st2 = st.clone();
    let tool_for = tool.clone();
    let result = st
        .cached(key, ttl, move || async move {
            let out = st2
                .mise
                .run(&["ls-remote".to_string(), tool_for.clone()], None, &[], LSREMOTE)
                .await
                .map_err(|e| e.to_string())?;
            let versions: Vec<String> = out
                .stdout
                .lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect();
            Ok(json!({"tool": tool_for, "versions": versions}))
        })
        .await;
    match result {
        Ok(v) => ok(v),
        Err(e) => err_resp(StatusCode::BAD_GATEWAY, "lsremote_failed", e),
    }
}

#[derive(Deserialize)]
struct InstallReq {
    tool: String,
    version: Option<String>,
    cwd: Option<String>,
}

async fn tools_install(State(st): State<AppState>, Json(req): Json<InstallReq>) -> ApiResult {
    if req.tool.is_empty() {
        return err_resp(StatusCode::BAD_REQUEST, "bad_request", "tool must not be empty".to_string());
    }
    let mut args = vec!["install".to_string()];
    match &req.version {
        Some(v) if !v.is_empty() => args.push(format!("{}@{}", req.tool, v)),
        _ => args.push(req.tool.clone()),
    }
    let out = match st.mise.run(&args, req.cwd.as_deref(), &[], HEAVY).await {
        Ok(o) => o,
        Err(e) => return err_resp(StatusCode::BAD_GATEWAY, "install_failed", e.to_string()),
    };
    let ok_flag = out.exit_code == 0;
    ok(json!({"ok": ok_flag, "exit_code": out.exit_code, "output": out.stdout + &out.stderr}))
}

#[derive(Deserialize)]
struct UseReq {
    tool: String,
    version: Option<String>,
    cwd: Option<String>,
    #[serde(default)]
    global: bool,
    env: Option<String>,
}

async fn tools_use(State(st): State<AppState>, Json(req): Json<UseReq>) -> ApiResult {
    if req.tool.is_empty() {
        return err_resp(StatusCode::BAD_REQUEST, "bad_request", "tool must not be empty".to_string());
    }
    let spec = match &req.version {
        Some(v) if !v.is_empty() => format!("{}@{}", req.tool, v),
        _ => req.tool.clone(),
    };
    let mut args = vec!["use".to_string(), spec];
    if req.global {
        args.push("-g".to_string());
    } else if let Some(e) = &req.env {
        args.push("-E".to_string());
        args.push(e.clone());
    }
    st.invalidate().await;
    let out = match st.mise.run(&args, req.cwd.as_deref(), &[], HEAVY).await {
        Ok(o) => o,
        Err(e) => return err_resp(StatusCode::BAD_GATEWAY, "use_failed", e.to_string()),
    };
    finish_write(out.exit_code, "use_failed", out.stdout, out.stderr, json!({"tool": req.tool}))
}

async fn tasks_list(State(st): State<AppState>, Query(q): Query<HashMap<String, String>>) -> ApiResult {
    let cwd = qs(&q, "cwd");
    let ttl = Duration::from_secs(st.cfg.cache_ttl_secs);
    let key = format!("tasks|{}", cwd.clone().unwrap_or_default());
    let st2 = st.clone();
    let cwd_for = cwd.clone();
    let result = st
        .cached(key, ttl, move || async move {
            st2.mise
                .run_json(&["tasks".to_string(), "ls".to_string(), "-J".to_string()], cwd_for.as_deref(), &[], READ)
                .await
                .map_err(|e| e.to_string())
        })
        .await;
    match result {
        Ok(v) => ok(json!({"ok": true, "cwd": cwd.unwrap_or_default(), "tasks": v})),
        Err(e) => err_resp(StatusCode::BAD_GATEWAY, "tasks_failed", e),
    }
}

async fn settings_list(State(st): State<AppState>) -> ApiResult {
    let ttl = Duration::from_secs(st.cfg.cache_ttl_secs);
    let st2 = st.clone();
    let result = st
        .cached("settings".to_string(), ttl, move || async move {
            st2.mise
                .run_json(&["settings".to_string(), "ls".to_string(), "-J".to_string()], None, &[], READ)
                .await
                .map_err(|e| e.to_string())
        })
        .await;
    match result {
        Ok(v) => ok(json!({"ok": true, "settings": v})),
        Err(e) => {
            let out = st.mise.run(&["settings".to_string(), "ls".to_string()], None, &[], READ).await;
            match out {
                Ok(o) => ok(json!({"ok": true, "settings": o.stdout, "raw": true})),
                Err(e2) => err_resp(StatusCode::BAD_GATEWAY, "settings_failed", format!("{e}; {e2}")),
            }
        }
    }
}

#[derive(Deserialize)]
struct SettingsSetReq {
    key: String,
    value: Option<String>,
    #[serde(default)]
    unset: bool,
}

async fn settings_set(State(st): State<AppState>, Json(req): Json<SettingsSetReq>) -> ApiResult {
    if req.key.is_empty() {
        return err_resp(StatusCode::BAD_REQUEST, "bad_request", "key must not be empty".to_string());
    }
    let mut args = vec!["settings".to_string()];
    if req.unset {
        args.push("unset".to_string());
        args.push(req.key.clone());
    } else {
        args.push("set".to_string());
        args.push(req.key.clone());
        args.push(req.value.clone().unwrap_or_else(|| "true".to_string()));
    }
    st.invalidate().await;
    let out = match st.mise.run(&args, None, &[], READ).await {
        Ok(o) => o,
        Err(e) => return err_resp(StatusCode::BAD_GATEWAY, "settings_write_failed", e.to_string()),
    };
    finish_write(out.exit_code, "settings_write_failed", out.stdout, out.stderr, json!({"key": req.key}))
}

async fn plugins_list(State(st): State<AppState>) -> ApiResult {
    let ttl = Duration::from_secs(st.cfg.cache_ttl_secs);
    let st2 = st.clone();
    let result = st
        .cached("plugins".to_string(), ttl, move || async move {
            match st2
                .mise
                .run_json(&["plugins".to_string(), "ls".to_string(), "-J".to_string()], None, &[], READ)
                .await
            {
                Ok(v) => Ok(v),
                Err(_) => {
                    let out = st2
                        .mise
                        .run(&["plugins".to_string(), "ls".to_string()], None, &[], READ)
                        .await
                        .map_err(|e| e.to_string())?;
                    let items: Vec<Value> = out
                        .stdout
                        .lines()
                        .map(|l| {
                            let name = l.split_whitespace().next().unwrap_or(l.trim()).to_string();
                            json!({"name": name})
                        })
                        .collect();
                    Ok(Value::Array(items))
                }
            }
        })
        .await;
    match result {
        Ok(v) => ok(json!({"ok": true, "plugins": v})),
        Err(e) => err_resp(StatusCode::BAD_GATEWAY, "plugins_failed", e),
    }
}
