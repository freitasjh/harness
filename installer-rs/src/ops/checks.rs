// runChecks (install.mjs:1252-1335 @ c63e333). Depois do apply: manifest-missing,
// config-missing/json-invalid, flagged-open, literal-denied, config-ref-missing.
// dry-run NUNCA roda checks (FU-28): passed:null, ran:false, skipped:true.
use crate::contract::Request;
use crate::error::EngineError;
use crate::ops::merge::{is_scannable_path, scan_literals};
use crate::ops::pathutil::str_arg;
use serde_json::{json, Value};
use std::path::Path;

fn block(what: &str, code: &str, fix: &str, where_: &str) -> Value {
    json!({ "what": what, "code": code, "fix": fix, "where": where_ })
}

fn read_text(abs: &Path) -> Option<String> {
    std::fs::read_to_string(abs).ok()
}

pub fn run_checks(target: &str, manifest: Option<&Value>) -> Value {
    let mut failed = Vec::new();
    let Some(manifest) = manifest else {
        failed.push(block(
            "manifest-missing: .harness-install.json nao informado",
            "manifest-missing",
            "informe o manifesto via .harness-install.json no target ou rode a instalacao antes dos checks.",
            target,
        ));
        return json!({ "passed": false, "failed": failed });
    };

    let manifest_path = Path::new(target).join(crate::ops::registry::MANIFEST_NAME);
    if !manifest_path.exists() {
        failed.push(block(
            "manifest-missing: .harness-install.json ausente no target",
            "manifest-missing",
            "rode a instalacao para gerar o manifesto e rode os checks de novo.",
            manifest_path.to_string_lossy().as_ref(),
        ));
    }
    for rel in ["opencode.json", "harness.config.json"] {
        let abs = Path::new(target).join(rel);
        if !abs.exists() {
            if rel == "harness.config.json" {
                failed.push(block(
                    "config-missing: harness.config.json ausente",
                    "config-missing",
                    "gere o harness.config.json via instalacao (generateConfig) no target.",
                    abs.to_string_lossy().as_ref(),
                ));
            }
            continue;
        }
        if let Some(raw) = read_text(&abs) {
            if serde_json::from_str::<Value>(&raw).is_err() {
                failed.push(block(
                    &format!("json-invalid: {} corrompido (R1)", rel),
                    "json-invalid",
                    "corrija o JSON apontado (valide com um parser) e rode os checks de novo.",
                    abs.to_string_lossy().as_ref(),
                ));
            }
        }
    }
    let empty_flagged: Vec<Value> = Vec::new();
    for f in manifest.get("flagged").and_then(|v| v.as_array()).unwrap_or(&empty_flagged) {
        let path = f["path"].as_str().unwrap_or("");
        failed.push(block(
            &format!("flagged-open: {} ({}) — resolucao humana pendente (I6)", path, f.get("reason").and_then(|v| v.as_str()).unwrap_or("sem motivo")),
            "flagged-open",
            "resolva cada item flagged manualmente e rode doctor/install de novo.",
            Path::new(target).join(path).to_string_lossy().as_ref(),
        ));
    }
    let empty = Vec::new();
    let listed = manifest.get("installed").and_then(|v| v.as_array()).unwrap_or(&empty)
        .iter().chain(manifest.get("merged").and_then(|v| v.as_array()).unwrap_or(&empty));
    for f in listed {
        let rel = f["path"].as_str().unwrap_or("");
        if !is_scannable_path(rel) { continue; }
        let abs = Path::new(target).join(rel);
        if abs.is_file() {
            if let Some(raw) = read_text(&abs) {
                for h in scan_literals(&raw) {
                    failed.push(block(
                        &format!("literal-denied: {} contem '{}' (R3/canario)", rel, h),
                        "literal-denied",
                        "remova a dependencia/uso da stack alheia do arquivo apontado.",
                        abs.to_string_lossy().as_ref(),
                    ));
                }
            }
        }
    }
    json!({ "passed": failed.is_empty(), "failed": failed })
}

pub fn dry_run_checks() -> Value {
    json!({
        "passed": Value::Null,
        "failed": [],
        "ran": false,
        "skipped": true,
        "reason": "dry-run: checks nao executados",
    })
}

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target = str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    let manifest = req.args.get("manifest");
    Ok(run_checks(target, manifest))
}
