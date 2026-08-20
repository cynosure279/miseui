// fake-mise: deterministic mise CLI fixture, implemented as a real Rust binary so
// integration tests run on every platform (Windows cannot exec .sh/.cmd directly).
// Behavior mirrors server/tests/fake-mise.sh; driven by env vars.
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
    let project = env::var("FAKE_MISE_PROJECT").unwrap_or_else(|_| ".".into());
    let project = norm(project);
    let home = env::var("HOME").unwrap_or_else(|_| ".".into());
    let home = norm(home);
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

    let cmd = first;
    match cmd {
        "--version" => {
            println!("2026.8.1-fake");
        }
        "env" => {
            let node_env = if env_name == "staging" { "staging" } else { "development" };
            if args.iter().any(|a| a == "--json-extended") {
                println!(
                    "{{\"PATH\":{{\"value\":\"{p}/shims:/usr/bin:{p}/shims:/usr/bin:/nonexistent-xyz\",\"source\":\"{p}/mise.toml\"}},\"NODE_ENV\":{{\"value\":\"{ne}\",\"source\":\"{p}/mise.toml\"}},\"GLOBAL_KEY\":{{\"value\":\"global-val\",\"source\":\"{h}/.config/mise/config.toml\"}},\"TOOL_VAR\":{{\"value\":\"node-tool-val\",\"tool\":\"node\",\"source\":\"{p}/mise.toml\"}},\"INHERITED_VAR\":{{\"value\":\"from-shell\"}}}}",
                    p = project, h = home, ne = node_env
                );
            } else if args.iter().any(|a| a == "--json") {
                println!("{{\"PATH\":\"{p}/shims:/usr/bin\",\"NODE_ENV\":\"{ne}\"}}", p = project, ne = node_env);
            } else {
                println!("PATH={p}/shims:/usr/bin", p = project);
            }
        }
        "doctor" => {
            if args.iter().any(|a| a == "--json") {
                println!(
                    "{{\"version\":\"2026.8.1-fake\",\"os\":{{\"name\":\"Linux\",\"version\":\"6.x\"}},\"shell\":{{\"name\":\"bash\",\"path\":\"/bin/bash\"}},\"settings\":{{}},\"env_files\":[\"{p}/.env\"],\"config_files\":[\"{p}/mise.toml\",\"{h}/.config/mise/config.toml\"],\"plugins\":[{{\"name\":\"node\",\"installed\":true}}],\"tools\":[{{\"name\":\"node\",\"version\":\"22.11.0\",\"source\":\"{p}/mise.toml\",\"requested_version\":\"22\",\"installed\":true}}],\"warnings\":[],\"problems\":[]}}",
                    p = project, h = home
                );
            } else {
                println!("mise doctor");
            }
        }
        "config" => {
            println!("[{{\"path\":\"{p}/mise.toml\"}},{{\"path\":\"{h}/.config/mise/config.toml\"}}]", p = project, h = home);
        }
        "ls" => {
            if args.iter().any(|a| a == "--json") {
                if ls_mode == "object" {
                    println!(
                        "{{\"node\":[{{\"version\":\"22.11.0\",\"requested_version\":\"22\",\"installed\":true,\"active\":true,\"source\":{{\"type\":\"mise.toml\",\"path\":\"{p}/mise.toml\"}}}}],\"go\":[{{\"version\":\"1.22.1\",\"requested_version\":\"latest\",\"installed\":false,\"active\":false,\"source\":{{\"type\":\"mise.toml\",\"path\":\"{p}/mise.toml\"}}}}]}}",
                        p = project
                    );
                } else {
                    println!(
                        "[{{\"name\":\"node\",\"version\":\"22.11.0\",\"installed\":true,\"source\":\"{p}/mise.toml\",\"requested_version\":\"22\"}},{{\"name\":\"go\",\"version\":\"1.22.1\",\"installed\":false,\"source\":\"{p}/mise.toml\",\"requested_version\":\"latest\"}}]",
                        p = project
                    );
                }
            } else {
                println!("node 22.11.0");
                println!("go   1.22.1");
            }
        }
        "ls-remote" => {
            println!("22.11.0");
            println!("22.10.0");
            println!("22.9.0");
            println!("20.15.0");
        }
        "install" | "use" => {
            if let Some(arg) = args.get(1) {
                println!("using {arg}");
            }
        }
        "tasks" => {
            println!("[{{\"name\":\"build\",\"description\":\"build it\"}},{{\"name\":\"test\",\"description\":\"run tests\"}}]");
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
                println!("{{\"env_file\":true,\"always_keep_download\":false,\"jobs\":4}}");
            } else if args.get(1).is_some() && (args[1] == "set" || args[1] == "unset") {
                println!("settings ok");
            } else {
                println!("env_file = true");
            }
        }
        "plugins" => {
            if args.iter().any(|a| a == "-J") {
                println!("[{{\"name\":\"node\",\"installed\":true}},{{\"name\":\"go\",\"installed\":true}}]");
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
