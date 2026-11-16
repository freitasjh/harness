// Fronteira contract-v1 (ADR-001 §2.1): stdin = 1 documento JSON, stdout = 1 envelope.
// exit 0 (ok) / 1 (erro de instalação) / 2 (somente protocolo — ADR-001 §2.2).
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, thiserror::Error)]
pub enum ProtocolError {
    #[error("envelope ausente")]
    Empty,
    #[error("json inválido")]
    InvalidJson,
    #[error("v desconhecido: {0}")]
    BadVersion(i64),
    #[error("op ausente")]
    MissingOp,
    #[error("op não registrada: {0}")]
    UnknownOp(String),
}

#[derive(Debug, Clone, Deserialize)]
pub struct Request {
    pub v: i64,
    pub op: String,
    #[serde(default)]
    pub args: Value,
    #[serde(default)]
    pub answers: Value,
    pub target: Option<String>,
}

pub fn parse_request(text: &str) -> Result<Request, ProtocolError> {
    if text.trim().is_empty() {
        return Err(ProtocolError::Empty);
    }
    let r: Request = serde_json::from_str(text).map_err(|_| ProtocolError::InvalidJson)?;
    if r.v != 1 {
        return Err(ProtocolError::BadVersion(r.v));
    }
    if r.op.trim().is_empty() {
        return Err(ProtocolError::MissingOp);
    }
    Ok(r)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ErrorBody {
    pub code: String,
    pub what: String,
    pub why: String,
    pub fix: String,
    #[serde(rename = "where")]
    pub where_: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Envelope {
    pub v: i32,
    pub ok: bool,
    pub op: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorBody>,
}

pub fn success_envelope(op: &str, result: Value) -> Envelope {
    Envelope { v: 1, ok: true, op: op.to_string(), result: Some(result), error: None }
}

pub fn error_envelope(op: &str, error: ErrorBody) -> Envelope {
    Envelope { v: 1, ok: false, op: op.to_string(), result: None, error: Some(error) }
}

pub fn envelope_json(env: &Envelope) -> String {
    serde_json::to_string(env).expect("envelope serializável")
}

pub fn exit_code(env: &Envelope) -> i32 {
    if env.ok { 0 } else { 1 }
}
