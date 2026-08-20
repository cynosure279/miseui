use std::path::PathBuf;
use std::time::Duration;
use anyhow::{anyhow, Result};
use serde_json::Value;
use tokio::process::Command;

/// Thin runner around the mise CLI. Always invoked with an argv array (never a shell string).
#[derive(Debug, Clone)]
pub struct Mise {
    pub bin: PathBuf,
}

#[derive(Debug, Clone)]
pub struct Output {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

impl Mise {
    pub fn new(bin: PathBuf) -> Self {
        Self { bin }
    }

    pub async fn run(
        &self,
        args: &[String],
        cwd: Option<&str>,
        env: &[(String, String)],
        timeout: Duration,
    ) -> Result<Output> {
        let mut cmd = Command::new(&self.bin);
        cmd.args(args);
        if let Some(c) = cwd {
            cmd.current_dir(c);
        }
        for (k, v) in env {
            cmd.env(k, v);
        }
        cmd.kill_on_drop(true);
        let output = tokio::time::timeout(timeout, cmd.output())
            .await
            .map_err(|_| anyhow!("timed out after {}s: mise {}", timeout.as_secs(), args.join(" ")))??;
        Ok(Output {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }

    /// Run mise and require JSON output on stdout. Non-zero exit or unparseable JSON => Err.
    pub async fn run_json(
        &self,
        args: &[String],
        cwd: Option<&str>,
        env: &[(String, String)],
        timeout: Duration,
    ) -> Result<Value> {
        let out = self.run(args, cwd, env, timeout).await?;
        if out.exit_code != 0 {
            return Err(anyhow!(
                "mise {} failed (exit {}): {}",
                args.join(" "),
                out.exit_code,
                out.stderr.trim()
            ));
        }
        let v: Value = serde_json::from_str(&out.stdout)
            .map_err(|e| anyhow!("invalid JSON from mise {}: {e}", args.join(" ")))?;
        Ok(v)
    }
}

/// Extra env for selecting a mise environment (e.g. [env.production] configs).
pub fn env_extra(env_name: Option<&str>) -> Vec<(String, String)> {
    env_name
        .map(|n| vec![("MISE_ENV".to_string(), n.to_string())])
        .unwrap_or_default()
}
