// writeManifest (install.mjs:1486-1491 @ c63e333). dryRun ⇒ {skipped:true,
// path:null} e ZERO writes; caso contrário o manifesto é gravado no target.
use crate::contract::Request;
use crate::error::EngineError;
use crate::ops::pathutil::{bool_arg, str_arg};
use serde_json::{json, Value};
use std::path::Path;

pub fn write_manifest(target: &str, manifest: &Value, dry_run: bool) -> Value {
    if dry_run {
        return json!({ "skipped": true, "path": Value::Null });
    }
    let abs = Path::new(target).join(crate::ops::registry::MANIFEST_NAME);
    let text = serde_json::to_string_pretty(manifest).unwrap_or_default();
    match std::fs::write(&abs, text) {
        Ok(_) => json!({ "skipped": false, "path": abs.to_string_lossy().to_string() }),
        Err(e) => json!({ "skipped": false, "path": Value::Null, "error": format!("{}", e) }),
    }
}

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target = str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    let manifest = req.args.get("manifest").cloned().unwrap_or_else(|| json!({}));
    Ok(write_manifest(target, &manifest, bool_arg(req, "dryRun")))
}
