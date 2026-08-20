// fake-mise: deterministic mise CLI fixture, implemented as a real Rust binary so
// integration tests run on every platform (Windows cannot exec .sh/.cmd directly).
// Driven by env vars; JSON built with serde_json to avoid escaping pitfalls.
use serde_json::json;
use std::env;
use std::fs::OpenOptions;
use std::io::Write;

fn main() -> std::process::ExitCode {
    let args: Vec<String> = std::env::args_os()
        .skip(1)
        .map(|a| a.to_string_lossy().into_owned())
        .collect();
    // Keep JSON valid on Windows: forward slashes are accepted by Path and JSON alike.
    let norm = |p: String| p.replace('\\', "/");
    let project = norm(env::var("FAKE_MISE_PROJECT").unwrap_or_else(|_| ".".into()));
    let home = norm(env::var("HOME").unwrap_or_else(|_| ".".into()));
    let env_name = env::var("MISE_ENV").unwrap_or_default();
    let ls_mode = env::var("FAKE_MISE_LS_MODE").unwrap_or_default();
    let fault = env::var("FAKE_MISE_FAULT").is_ok();

    if let Ok(log) = env::var("FAKE_MISE_LOG") {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&log) {
            let _ = writeln!(f, "{}", args.join(" "));
        }
    }

    let first = args.first().map(|s| s.as_str()).unwrap_or("");
    if fault && first == "env" {
        eprintln!("simulated failure");
        return std::process::ExitCode::from(1);
    }

    let proj_toml = format!("{project}/mise.toml");
    let global_toml = format!("{home}/.config/mise/config.toml");

    match first {
        "--version" => println!("2026.8.1-fake"),
        "env" => {
            let node_env = if env_name == "staging" { "staging" } else { "development" };
            let sep = if cfg!(windows) { ";" } else { ":" };
            let path_val = format!("{project}/shims{sep}/usr/bin{sep}{project}/shims{sep}/usr/bin{sep}/nonexistent-xyz");
            if args.iter().any(|a| a == "--json-extended") {
                let v = json!({
                    "PATH": {"value": path_val, "source": proj_toml},
                    "NODE_ENV": {"value": node_env, "source": proj_toml},
                    "GLOBAL_KEY": {"value": "global-val", "source": global_toml},
                    "TOOL_VAR": {"value": "node-tool-val", "tool": "node", "source": proj_toml},
                    "INHERITED_VAR": {"value": "from-shell"},
                });
                println!("{v}");
            } else if args.iter().any(|a| a == "--json") {
                let v = json!({"PATH": path_val, "NODE_ENV": node_env});
                println!("{v}");
            } else {
                println!("PATH={path_val}");
            }
        }
        "doctor" => {
            if args.iter().any(|a| a == "--json") {
                let v = json!({
                    "version": "2026.8.1-fake",
                    "os": {"name": "Linux", "version": "6.x"},
                    "shell": {"name": "bash", "path": "/bin/bash"},
                    "settings": {},
                    "env_files": [format!("{project}/.env")],
                    "config_files": [proj_toml, global_toml],
                    "plugins": [{"name": "node", "installed": true}],
                    "tools": [{"name": "node", "version": "22.11.0", "source": proj_toml, "requested_version": "22", "installed": true}],
                    "warnings": [],
                    "problems": [],
                });
                println!("{v}");
            } else {
                println!("mise doctor");
            }
        }
        "config" => {
            let v = json!([{"path": proj_toml}, {"path": global_toml}]);
            println!("{v}");
        }
        "ls" => {
            if args.iter().any(|a| a == "--json") {
                if ls_mode == "object" {
                    let v = json!({
                        "node": [{"version": "22.11.0", "requested_version": "22", "installed": true, "active": true, "source": {"type": "mise.toml", "path": proj_toml}}],
                        "go": [{"version": "1.22.1", "requested_version": "latest", "installed": false, "active": false, "source": {"type": "mise.toml", "path": proj_toml}}],
                    });
                    println!("{v}");
                } else {
                    let v = json!([
                        {"name": "node", "version": "22.11.0", "installed": true, "source": proj_toml, "requested_version": "22"},
                        {"name": "go", "version": "1.22.1", "installed": false, "source": proj_toml, "requested_version": "latest"},
                    ]);
                    println!("{v}");
                }
            } else {
                println!("node 22.11.0");
                println!("go   1.22.1");
            }
        }
        "ls-remote" => {
            for v in ["22.11.0", "22.10.0", "22.9.0", "20.15.0"] {
                println!("{v}");
            }
        }
        "install" | "use" => {
            if let Some(arg) = args.get(1) {
                println!("using {arg}");
            }
        }
        "tasks" => {
            let v = json!([
                {"name": "build", "description": "build it"},
                {"name": "test", "description": "run tests"},
            ]);
            println!("{v}");
        }
        "run" => {
            if args.get(1).map(|s| s.as_str()) == Some("fail") {
                eprintln!("boom");
                return std::process::ExitCode::from(3);
            }
            println!("building...");
            println!("done");
        }
        "settings" => {
            if args.iter().any(|a| a == "-J") {
                let v = json!({"env_file": true, "always_keep_download": false, "jobs": 4});
                println!("{v}");
            } else if args.get(1).is_some() && (args[1] == "set" || args[1] == "unset") {
                println!("settings ok");
            } else {
                println!("env_file = true");
            }
        }
        "plugins" => {
            if args.iter().any(|a| a == "-J") {
                let v = json!([{"name": "node", "installed": true}, {"name": "go", "installed": true}]);
                println!("{v}");
            } else {
                println!("node");
                println!("go");
            }
        }
        "set" => println!("set ok"),
        "unset" => println!("unset ok"),
        other => {
            eprintln!("fake-mise: unhandled args: {other}");
            return std::process::ExitCode::from(2);
        }
    }
    std::process::ExitCode::SUCCESS
}
