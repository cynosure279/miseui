use std::path::PathBuf;
use anyhow::Result;
use serde::Deserialize;

use crate::cli::CliArgs;

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub mise_bin: PathBuf,
    pub token: String,
    pub allow_origins: Vec<String>,
    pub cache_ttl_secs: u64,
    pub log_level: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 18771,
            mise_bin: PathBuf::from("mise"),
            token: String::new(),
            allow_origins: Vec::new(),
            cache_ttl_secs: 5,
            log_level: "info".to_string(),
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct FileConfig {
    host: Option<String>,
    port: Option<u16>,
    mise_bin: Option<PathBuf>,
    token: Option<String>,
    allow_origins: Option<Vec<String>>,
    cache_ttl_secs: Option<u64>,
    log_level: Option<String>,
}

impl Config {
    /// Resolution order: defaults < config file < env vars (MISEUI_*) < CLI args.
    pub fn from_cli(cli: &CliArgs) -> Result<Config> {
        let mut cfg = match &cli.config {
            Some(path) => {
                let text = std::fs::read_to_string(path)?;
                let file: FileConfig = toml::from_str(&text)?;
                let mut c = Config::default();
                if let Some(v) = file.host { c.host = v; }
                if let Some(v) = file.port { c.port = v; }
                if let Some(v) = file.mise_bin { c.mise_bin = v; }
                if let Some(v) = file.token { c.token = v; }
                if let Some(v) = file.allow_origins { c.allow_origins = v; }
                if let Some(v) = file.cache_ttl_secs { c.cache_ttl_secs = v; }
                if let Some(v) = file.log_level { c.log_level = v; }
                c
            }
            None => Config::default(),
        };

        if let Ok(v) = std::env::var("MISEUI_HOST") { cfg.host = v; }
        if let Ok(v) = std::env::var("MISEUI_PORT") { cfg.port = v.parse()?; }
        if let Ok(v) = std::env::var("MISEUI_MISE_BIN") { cfg.mise_bin = PathBuf::from(v); }
        if let Ok(v) = std::env::var("MISEUI_TOKEN") { cfg.token = v; }
        if let Ok(v) = std::env::var("MISEUI_CACHE_TTL") { cfg.cache_ttl_secs = v.parse()?; }
        if let Ok(v) = std::env::var("MISEUI_LOG_LEVEL") { cfg.log_level = v; }
        if let Ok(v) = std::env::var("MISEUI_ALLOW_ORIGIN") {
            cfg.allow_origins = v.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        }

        if let Some(v) = &cli.host { cfg.host = v.clone(); }
        if let Some(v) = cli.port { cfg.port = v; }
        if let Some(v) = &cli.mise_bin { cfg.mise_bin = PathBuf::from(v); }
        if let Some(v) = &cli.token { cfg.token = v.clone(); }
        if !cli.allow_origin.is_empty() { cfg.allow_origins = cli.allow_origin.clone(); }
        if let Some(v) = cli.cache_ttl { cfg.cache_ttl_secs = v; }
        if let Some(v) = &cli.log_level { cfg.log_level = v.clone(); }

        Ok(cfg)
    }
}
