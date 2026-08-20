mod api;
mod cli;
mod config;
mod mise;
mod models;
mod ws;

use std::sync::Arc;

use clap::Parser;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = cli::CliArgs::parse();
    let cfg = config::Config::from_cli(&cli)?;

    let level = if cfg.log_level.is_empty() { "info".to_string() } else { cfg.log_level.clone() };
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(format!("info,miseui_server={level}"))),
        )
        .init();

    tracing::info!(
        port = cfg.port,
        host = %cfg.host,
        mise_bin = %cfg.mise_bin.display(),
        auth = if cfg.token.is_empty() { "off" } else { "on" },
        "miseui-server starting"
    );

    let state = api::AppState::new(Arc::new(cfg.clone()));
    let app = api::router(state);

    let listener = tokio::net::TcpListener::bind((cfg.host.as_str(), cfg.port)).await?;
    let actual = listener.local_addr()?;
    tracing::info!(addr = %actual, "listening");

    if let Some(pf) = &cli.port_file {
        tokio::fs::write(pf, actual.port().to_string()).await?;
        tracing::info!(port_file = %pf.display(), "wrote actual port");
    }

    axum::serve(listener, app).await?;
    Ok(())
}
