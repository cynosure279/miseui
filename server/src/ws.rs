use std::collections::HashMap;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::response::IntoResponse;
use futures_util::sink::SinkExt;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::api::AppState;

pub async fn stream_ws(
    State(st): State<AppState>,
    ws: WebSocketUpgrade,
    Query(_q): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle(socket, st))
}

async fn handle(mut socket: WebSocket, st: AppState) {
    let first = match socket.recv().await {
        Some(Ok(Message::Text(t))) => t.to_string(),
        Some(Ok(Message::Binary(b))) => String::from_utf8_lossy(&b).to_string(),
        _ => return,
    };
    let parsed: Value = match serde_json::from_str(&first) {
        Ok(v) => v,
        Err(_) => return,
    };
    match parsed.get("cmd").and_then(|c| c.as_str()) {
        Some("task:run") => {
            let task = parsed.get("task").and_then(|t| t.as_str()).unwrap_or("").to_string();
            let args: Vec<String> = parsed
                .get("args")
                .and_then(|a| a.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                .unwrap_or_default();
            let cwd = parsed.get("cwd").and_then(|c| c.as_str()).map(String::from);
            if task.is_empty() {
                let _ = socket.send(Message::Text(json!({"type": "exit", "code": 2}).to_string().into())).await;
                return;
            }
            run_task(&mut socket, &st, &task, &args, cwd.as_deref()).await;
        }
        Some("ping") => {
            let _ = socket.send(Message::Text(json!({"type": "pong"}).to_string().into())).await;
        }
        _ => {}
    }
    let _ = socket.close().await;
}

async fn run_task(socket: &mut WebSocket, st: &AppState, task: &str, args: &[String], cwd: Option<&str>) {
    let mut cmd = Command::new(&st.cfg.mise_bin);
    cmd.arg("run").arg(task);
    for a in args {
        cmd.arg(a);
    }
    if let Some(c) = cwd {
        cmd.current_dir(c);
    }
    cmd.kill_on_drop(true);
    cmd.stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped());
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let _ = socket
                .send(Message::Text(json!({"type": "exit", "code": -1, "error": e.to_string()}).to_string().into()))
                .await;
            return;
        }
    };

    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(512);

    if let Some(stdout) = child.stdout.take() {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if tx.send(format!("out|{line}")).await.is_err() {
                    break;
                }
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if tx.send(format!("err|{line}")).await.is_err() {
                    break;
                }
            }
        });
    }

    let status = child.wait().await;
    let code = status.ok().and_then(|s| s.code()).unwrap_or(-1);
    drop(tx);
    while let Some(msg) = rx.recv().await {
        let (stream, line) = match msg.split_once('|') {
            Some((s, l)) => (s.to_string(), l.to_string()),
            None => ("out".to_string(), msg),
        };
        let payload = json!({"type": "log", "stream": stream, "line": line}).to_string();
        if socket.send(Message::Text(payload.into())).await.is_err() {
            return;
        }
    }
    let _ = socket.send(Message::Text(json!({"type": "exit", "code": code}).to_string().into())).await;
}
