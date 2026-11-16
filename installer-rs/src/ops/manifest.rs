// buildManifest (install.mjs:1101-1128 @ c63e333): manifesto v1, fileHashes
// por SHA-256, flaggedResolution/validationMarks. Nenhum campo novo.
use crate::ops::pathutil::{iso_z, str_arg};
use crate::ops::registry::QUESTIONS;
use crate::contract::Request;
use crate::error::EngineError;
use serde_json::{json, Value};

pub fn serialize_answers(answers: &Value) -> Value {
    let mut out = serde_json::Map::new();
    for q in QUESTIONS.iter().filter(|q| !q.secret) {
        if let Some(v) = answers.get(q.key) {
            if !v.is_null() { out.insert(q.key.into(), v.clone()); }
        }
    }
    if let Some(v) = answers.get("answersVersion") {
        if !v.is_null() { out.insert("answersVersion".into(), v.clone()); }
    }
    Value::Object(out)
}

fn as_array(v: Option<&Value>) -> Vec<Value> {
    v.and_then(|x| x.as_array()).cloned().unwrap_or_default()
}

pub fn build_manifest(p: &Value) -> Value {
    let target = p.get("target").and_then(|v| v.as_str()).unwrap_or("");
    let installed = as_array(p.get("installed"));
    let merged = as_array(p.get("merged"));
    let flagged = as_array(p.get("flagged"));
    let answers = p.get("answers").cloned().unwrap_or_else(|| json!({}));
    let checks = p.get("checks").cloned().unwrap_or_else(|| json!({"passed": true, "failed": []}));
    let file_contents = p.get("fileContents").cloned().unwrap_or_else(|| json!({}));
    let source = p.get("source").and_then(|v| v.as_str()).unwrap_or("harness@0.1.0");
    let backup_dir = p.get("backupDir").cloned().unwrap_or(Value::Null);

    let mut file_hashes = Vec::new();
    for f in installed.iter().chain(merged.iter()) {
        let path = f["path"].as_str().unwrap_or("");
        let Some(body) = file_contents.get(path).and_then(|v| v.as_str()) else { continue };
        let mut entry = serde_json::Map::new();
        entry.insert("path".into(), Value::String(path.into()));
        entry.insert("sha256".into(), Value::String(crate::hash::sha256_hex(body)));
        if let Some(pre) = f.get("preMergeSha256").and_then(|v| v.as_str()) {
            entry.insert("preMergeSha256".into(), Value::String(pre.into()));
        }
        file_hashes.push(Value::Object(entry));
    }

    let flagged_slim: Vec<Value> = flagged
        .iter()
        .map(|f| json!({"path": f["path"], "reason": f.get("reason").and_then(|v| v.as_str()).unwrap_or("flagged")}))
        .collect();
    let flagged_resolution: Vec<Value> = flagged
        .iter()
        .map(|f| json!({"path": f["path"], "status": "open", "how": ""}))
        .collect();
    let serialized = serialize_answers(&answers);
    let validation_marks: Vec<Value> = serialized
        .as_object()
        .map(|m| m.keys().map(|k| json!({"item": k, "status": "validated"})).collect())
        .unwrap_or_default();
    let backup_resolved = backup_dir.as_str().map(|s| Value::String(crate::ops::pathutil::resolve_path(s))).unwrap_or(backup_dir.clone());

    json!({
        "version": "0.1.0",
        "date": iso_z(),
        "source": source,
        "target": crate::ops::pathutil::resolve_path(target),
        "installed": installed,
        "merged": merged,
        "flagged": flagged_slim,
        "backupDir": backup_resolved,
        "answers": serialized,
        "checks": checks,
        "manifestSchemaVersion": 1,
        "fileHashes": file_hashes,
        "flaggedResolution": flagged_resolution,
        "validationMarks": validation_marks,
    })
}

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let args = req.args.get("manifest").cloned().unwrap_or_else(|| req.args.clone());
    Ok(build_manifest(&args))
}

pub fn read_manifest(target: &str) -> Option<Value> {
    let p = std::path::Path::new(target).join(crate::ops::registry::MANIFEST_NAME);
    std::fs::read_to_string(p).ok().and_then(|s| serde_json::from_str(&s).ok())
}

pub fn manifest_file_hashes(m: &Value) -> serde_json::Map<String, Value> {
    let mut out = serde_json::Map::new();
    if let Some(arr) = m.get("fileHashes").and_then(|v| v.as_array()) {
        for e in arr {
            if let (Some(p), Some(h)) = (
                e.get("path").and_then(|v| v.as_str()),
                e.get("sha256").or_else(|| e.get("hash")).or_else(|| e.get("sha")).and_then(|v| v.as_str()),
            ) {
                out.insert(p.into(), Value::String(h.into()));
            }
        }
    }
    out
}

#[allow(dead_code)]
fn _str_arg_used(req: &Request) -> Option<&str> { str_arg(req, "target") }
