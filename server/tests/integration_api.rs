use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::time::Duration;

use reqwest::{Client, StatusCode};
use serde_json::Value;
use tempfile::TempDir;

const MISE_BIN: &str = env!("CARGO_BIN_EXE_miseui-server");

struct ServerGuard {
    _child: Child,
    base: String,
    dir: TempDir,
    log: PathBuf,
}

async fn start_server(token: &str, fault: bool) -> ServerGuard {
    start_server_with_env(token, fault, "", "").await
}

async fn start_server_with_env(token: &str, fault: bool, extra_key: &str, extra_val: &str) -> ServerGuard {
    let dir = tempfile::tempdir().unwrap();
    // Windows cannot exec a .sh directly: route through a .cmd wrapper using Git Bash.
    let fixture_name = if cfg!(windows) { "fake-mise.cmd" } else { "fake-mise.sh" };
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests").join(fixture_name);
    let port_file = dir.path().join("port");
    let log_file = dir.path().join("fake-mise.log");
    let mut cmd = Command::new(MISE_BIN);
    cmd.arg("--mise-bin").arg(&fixture)
        .arg("--port").arg("0")
        .arg("--port-file").arg(&port_file)
        .arg("--cache-ttl").arg("30");
    if !token.is_empty() {
        cmd.arg("--token").arg(token);
    }
    cmd.env("FAKE_MISE_PROJECT", dir.path());
    cmd.env("FAKE_MISE_LOG", &log_file);
    cmd.env("RUST_BACKTRACE", "0");
    if fault {
        cmd.env("FAKE_MISE_FAULT", "1");
    }
    if !extra_key.is_empty() {
        cmd.env(extra_key, extra_val);
    }
    let child = cmd.spawn().unwrap();

    let mut port = 0u16;
    for _ in 0..200 {
        if let Ok(text) = std::fs::read_to_string(&port_file) {
            if let Ok(p) = text.trim().parse::<u16>() {
                port = p;
                break;
            }
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    assert_ne!(port, 0, "server did not write port file");
    ServerGuard {
        _child: child,
        base: format!("http://127.0.0.1:{port}"),
        dir,
        log: log_file,
    }
}

#[tokio::test]
async fn t_tools_object_shape_normalized() {
    let g = start_server_with_env("", false, "FAKE_MISE_LS_MODE", "object").await;
    let c = auth_client("");
    let (s, b) = get_json(&c, &format!("{}/api/v1/tools", g.base)).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b["ok"], true);
    let tools = b["tools"].as_array().expect("tools must be normalized to an array");
    assert_eq!(tools.len(), 2);
    let node = tools.iter().find(|t| t["name"] == "node").expect("node present");
    assert_eq!(node["version"], "22.11.0");
    assert_eq!(node["installed"], true);
    assert_eq!(node["source"], format!("{}/mise.toml", g.dir.path().display()));
}

fn auth_client(token: &str) -> Client {
    let mut headers = reqwest::header::HeaderMap::new();
    if !token.is_empty() {
        headers.insert(
            "x-miseui-token",
            reqwest::header::HeaderValue::from_str(token).unwrap(),
        );
    }
    Client::builder().default_headers(headers).build().unwrap()
}

async fn get_json(client: &Client, url: &str) -> (StatusCode, Value) {
    let resp = client.get(url).send().await.unwrap();
    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or_default();
    (status, body)
}

fn proj(g: &ServerGuard) -> PathBuf {
    g.dir.path().to_path_buf()
}

#[tokio::test]
async fn t_health() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let (s, b) = get_json(&c, &format!("{}/api/v1/health", g.base)).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b["status"], "ok");
    assert_eq!(b["mise"], "2026.8.1-fake");
    assert_eq!(b["auth"], false);
}

#[tokio::test]
async fn t_env_vars_and_provenance() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let url = format!("{}/api/v1/env?cwd={}", g.base, proj(&g).display());
    let (s, b) = get_json(&c, &url).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b["ok"], true);
    let vars = b["vars"].as_array().unwrap();
    let by = |k: &str| vars.iter().find(|v| v["key"] == k).cloned();
    let path = by("PATH").unwrap();
    assert!(path["value"].as_str().unwrap().contains("shims"));
    assert!(path["source"].as_str().unwrap().contains("mise.toml"));
    let tool = by("TOOL_VAR").unwrap();
    assert_eq!(tool["tool"], "node");
    let inherited = by("INHERITED_VAR").unwrap();
    assert!(inherited.get("source").is_none());
}

#[tokio::test]
async fn t_env_path_analysis() {
    let g = start_server("", false).await;
    let c = auth_client("");
    std::fs::create_dir_all(proj(&g).join("shims")).unwrap();
    let url = format!("{}/api/v1/env/path?cwd={}", g.base, proj(&g).display());
    let (s, b) = get_json(&c, &url).await;
    assert_eq!(s, StatusCode::OK);
    let entries = b["entries"].as_array().unwrap();
    let shims_dir = format!("{}/shims", proj(&g).display());
    let shims = entries.iter().find(|e| e["path"] == shims_dir).cloned().unwrap();
    assert_eq!(shims["is_shim"], true);
    assert_eq!(shims["missing"], false);
    let missing = entries.iter().find(|e| e["path"] == "/nonexistent-xyz").cloned().unwrap();
    assert_eq!(missing["missing"], true);
    let usrbin: Vec<&Value> = entries.iter().filter(|e| e["path"] == "/usr/bin").collect();
    assert_eq!(usrbin.len(), 2);
    assert_eq!(usrbin[0]["duplicate"], false);
    assert_eq!(usrbin[1]["duplicate"], true);
}

#[tokio::test]
async fn t_env_diff() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let proj_buf = proj(&g);
    let p = proj_buf.display();
    let url = format!("{}/api/v1/env/diff?a_cwd={}&b_cwd={}&b_env=staging", g.base, p, p);
    let (s, b) = get_json(&c, &url).await;
    assert_eq!(s, StatusCode::OK);
    let diff = b["diff"].as_array().unwrap();
    let node = diff.iter().find(|d| d["key"] == "NODE_ENV").unwrap();
    assert_eq!(node["state"], "changed");
    assert_eq!(node["a_value"], "development");
    assert_eq!(node["b_value"], "staging");
}

#[tokio::test]
async fn t_config_list_and_raw() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let p = proj(&g);
    std::fs::write(p.join("mise.toml"), "[env]\nHELLO=\"world\"\n").unwrap();
    let url = format!("{}/api/v1/config?cwd={}", g.base, p.display());
    let (s, b) = get_json(&c, &url).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b["configs"].as_array().unwrap().len(), 2);

    let raw = format!("{}/api/v1/config/raw?cwd={}&file={}", g.base, p.display(), p.join("mise.toml").display());
    let (s, b) = get_json(&c, &raw).await;
    assert_eq!(s, StatusCode::OK);
    assert!(b["content"].as_str().unwrap().contains("HELLO"));

    let secret = p.join("secret.toml");
    std::fs::write(&secret, "secret").unwrap();
    let raw2 = format!("{}/api/v1/config/raw?cwd={}&file={}", g.base, p.display(), secret.display());
    let (s, b) = get_json(&c, &raw2).await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    assert_eq!(b["code"], "file_not_allowed");
}

#[tokio::test]
async fn t_doctor() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let (s, b) = get_json(&c, &format!("{}/api/v1/doctor", g.base)).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b["data"]["version"], "2026.8.1-fake");
    assert_eq!(b["exit_code"], 0);
}

#[tokio::test]
async fn t_tools() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let (s, b) = get_json(&c, &format!("{}/api/v1/tools", g.base)).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b["tools"].as_array().unwrap().len(), 2);

    let (s, b) = get_json(&c, &format!("{}/api/v1/tools/versions?tool=node", g.base)).await;
    assert_eq!(s, StatusCode::OK);
    assert!(b["versions"].as_array().unwrap().iter().any(|v| v == "22.11.0"));

    let resp = c.post(format!("{}/api/v1/tools/install", g.base))
        .json(&serde_json::json!({"tool":"node","version":"22.11.0"}))
        .send().await.unwrap();
    let b: Value = resp.json().await.unwrap();
    assert_eq!(b["ok"], true);

    let resp = c.post(format!("{}/api/v1/tools/use", g.base))
        .json(&serde_json::json!({"tool":"node","version":"22.11.0"}))
        .send().await.unwrap();
    let b: Value = resp.json().await.unwrap();
    assert_eq!(b["ok"], true);
}

#[tokio::test]
async fn t_tasks_settings_plugins() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let (s, b) = get_json(&c, &format!("{}/api/v1/tasks", g.base)).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b["tasks"].as_array().unwrap().len(), 2);

    let (s, b) = get_json(&c, &format!("{}/api/v1/settings", g.base)).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b["settings"]["env_file"], true);

    let (s, b) = get_json(&c, &format!("{}/api/v1/plugins", g.base)).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(b["plugins"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn t_env_set_and_unset() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let resp = c.post(format!("{}/api/v1/env/set", g.base))
        .json(&serde_json::json!({"key":"FOO","value":"bar"}))
        .send().await.unwrap();
    let b: Value = resp.json().await.unwrap();
    assert_eq!(b["ok"], true);
    assert_eq!(b["exit_code"], 0);

    let resp = c.post(format!("{}/api/v1/env/unset", g.base))
        .json(&serde_json::json!({"key":"FOO"}))
        .send().await.unwrap();
    let b: Value = resp.json().await.unwrap();
    assert_eq!(b["ok"], true);
}

#[tokio::test]
async fn t_auth_required() {
    let g = start_server("sekret", false).await;
    let c = auth_client("");
    let (s, _) = get_json(&c, &format!("{}/api/v1/health", g.base)).await;
    assert_eq!(s, StatusCode::OK);
    let (s, b) = get_json(&c, &format!("{}/api/v1/env", g.base)).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    assert_eq!(b["code"], "unauthorized");
    let c2 = auth_client("sekret");
    let (s, _) = get_json(&c2, &format!("{}/api/v1/env", g.base)).await;
    assert_eq!(s, StatusCode::OK);
}

#[tokio::test]
async fn t_env_failure_is_502() {
    let g = start_server("", true).await;
    let c = auth_client("");
    let (s, b) = get_json(&c, &format!("{}/api/v1/env", g.base)).await;
    assert_eq!(s, StatusCode::BAD_GATEWAY);
    assert_eq!(b["code"], "mise_env_failed");
}

#[tokio::test]
async fn t_cache_second_call_no_respawn() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let url = format!("{}/api/v1/env?cwd={}", g.base, proj(&g).display());
    for _ in 0..2 {
        let (s, b) = get_json(&c, &url).await;
        assert_eq!(s, StatusCode::OK);
        assert_eq!(b["ok"], true);
    }
    // cache TTL is 30s, so the 2nd call must NOT respawn mise env.
    let log = std::fs::read_to_string(&g.log).unwrap_or_default();
    let env_calls = log.lines().filter(|l| *l == "env --json-extended").count();
    assert_eq!(env_calls, 1, "expected exactly 1 mise env spawn: {log}");
}

#[tokio::test]
async fn t_not_found() {
    let g = start_server("", false).await;
    let c = auth_client("");
    let (s, b) = get_json(&c, &format!("{}/api/v1/nope", g.base)).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    assert_eq!(b["code"], "not_found");
}

