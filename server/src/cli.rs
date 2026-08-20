use std::path::PathBuf;
use clap::Parser;

/// MiseUI middleware: configurable HTTP/WS bridge to the mise CLI.
#[derive(Debug, Parser)]
#[command(name = "miseui-server", version, about)]
pub struct CliArgs {
    /// Host/interface to bind (0.0.0.0 enables remote access; then --token is required)
    #[arg(long)]
    pub host: Option<String>,

    /// Port to listen on (0 lets the OS pick; see --port-file)
    #[arg(long)]
    pub port: Option<u16>,

    /// After binding, write the actual port to this file (useful for tests and the GUI shell)
    #[arg(long)]
    pub port_file: Option<PathBuf>,

    /// Path to the mise binary or an executable script (e.g. a fake-mise test fixture)
    #[arg(long)]
    pub mise_bin: Option<String>,

    /// Path to a TOML config file (precedence: CLI args > env > file > defaults)
    #[arg(long)]
    pub config: Option<PathBuf>,

    /// Auth token. Required when non-empty; sent via X-Miseui-Token header or ?token=
    #[arg(long)]
    pub token: Option<String>,

    /// Allowed CORS origin (repeatable). Empty = allow any origin.
    #[arg(long)]
    pub allow_origin: Vec<String>,

    /// Cache TTL in seconds for read endpoints (default: 5)
    #[arg(long)]
    pub cache_ttl: Option<u64>,

    /// Log level (error/warn/info/debug/trace)
    #[arg(long)]
    pub log_level: Option<String>,
}
