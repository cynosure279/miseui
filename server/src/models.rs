use axum::http::StatusCode;
use axum::response::Json;
use serde::Serialize;
use serde_json::{json, Value};

pub type ApiResult = (StatusCode, Json<Value>);

pub fn ok(v: Value) -> ApiResult {
    (StatusCode::OK, Json(v))
}

pub fn err_resp(status: StatusCode, code: &str, message: String) -> ApiResult {
    (status, Json(json!({"ok": false, "code": code, "message": message})))
}

#[derive(Debug, Serialize, Clone)]
pub struct EnvVariable {
    pub key: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<String>,
}
