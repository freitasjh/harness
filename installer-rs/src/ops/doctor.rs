// runDoctor (install.mjs:1348-1484 @ c63e333). D0..D6 SOMENTE LEITURA,
// vereditos SAUDÁVEL(0)/ATENÇÃO(1)/QUEBRADO(1). report.verdict é REPORTADO
// (doctorPre no upgrade), NUNCA gate (EX-BE-05). Zero writes por construção.
use crate::contract::{parse_request, Request};
use crate::error::EngineError;
use crate::ops::manifest::read_manifest;
use crate::ops::merge::{plan_merge, scan_literals};
use crate::ops::pathutil::str_arg;
use crate::ops::registry;
use serde_json::{json, Map, Value};
use std::path::Path;

fn req_for(op: &str, args: Value, target: &str) -> Request {
    let text = format!(
        "{{\"v\":1,\"op\":\"{}\",\"args\":{},\"answers\":{{}},\"target\":{}}}",
        op, args, json!(target)
    );
    parse_request(&text).expect("request interno do doctor")
}

fn answers_from(answers_file: Option<&str>, target: &str) -> Value {
    if let Some(p) = answers_file {
        if let Ok(raw) = std::fs::read_to_string(p) {
            if let Ok(v) = serde_json::from_str::<Value>(&raw) {
                return v;
            }
        }
    }
    read_manifest(target)
        .and_then(|m| m.get("answers").cloned())
        .unwrap_or_else(|| json!({}))
}

fn destination_stack(answers: &Value) -> Option<String> {
    answers.get("stack").and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(str::to_string)
}

pub fn analyze(target: &str, source_dir: Option<&str>, answers_file: Option<&str>, backup_dir: Option<&str>, allow_root: bool) -> Result<Value, EngineError> {
    let pf = crate::ops::preflight::run(&req_for(
        "preflight",
        json!({"target": target, "allowRoot": allow_root, "nodeVersion": "20.0.0", "skipManifestGuard": true}),
        target,
    ))?;
    let pf_target = pf["target"].as_str().unwrap_or(target).to_string();

    if let Some(b) = backup_dir {
        crate::ops::backup_dir::run(&req_for(
            "resolveBackupDir",
            json!({"target": pf_target, "backupRoot": b}),
            &pf_target,
        ))?;
    }

    let inv = crate::ops::inventory::run(&req_for("inventory", json!({"target": pf_target}), &pf_target))?;
    let answers = answers_from(answers_file, &pf_target);
    let stack = destination_stack(&answers);
    let prof = stack.as_deref().and_then(registry::profile_of);
    let stacks: Vec<String> = prof.map(|p| p.stacks.iter().map(|s| s.to_string()).collect()).unwrap_or_default();

    let mut collect_args = json!({"sourceDir": source_dir.unwrap_or(""), "stacks": stacks, "stack": stack});
    if source_dir.is_none() {
        collect_args["sourceDir"] = json!("");
    }
    let incoming = crate::ops::incoming::collect(&req_for("collectIncoming", collect_args, &pf_target))?;
    let mut files: Map<String, Value> = incoming.as_object().cloned().unwrap_or_default();
    files.insert("harness.config.json".into(), Value::String(String::new()));
    let plan = plan_merge(&pf_target, &files)?;

    let mut counts = serde_json::Map::new();
    for p in &plan {
        let a = p["action"].as_str().unwrap_or("");
        let entry = counts.entry(a.to_string()).or_insert(json!(0));
        *entry = json!(entry.as_i64().unwrap_or(0) + 1);
    }

    // D4 checks (somente leitura): JSON inválido, flagged-open, literal-denied.
    let mut failed: Vec<Value> = Vec::new();
    for rel in ["opencode.json", "harness.config.json"] {
        let abs = Path::new(&pf_target).join(rel);
        if let Ok(raw) = std::fs::read_to_string(&abs) {
            if serde_json::from_str::<Value>(&raw).is_err() {
                failed.push(json!({
                    "code": "json-invalid",
                    "what": format!("json-invalid: {} corrompido", rel),
                    "fix": "corrija o JSON apontado e rode os checks de novo.",
                    "where": abs.to_string_lossy(),
                }));
            }
        }
    }
    for p in &plan {
        if p["action"] == "flag" {
            failed.push(json!({
                "code": "flagged-open",
                "what": format!("flagged-open: {} ({}) — resolucao humana pendente", p["path"], p.get("reason").and_then(|v| v.as_str()).unwrap_or("sem motivo")),
                "fix": "resolva cada item flagged manualmente.",
                "where": Path::new(&pf_target).join(p["path"].as_str().unwrap_or("")).to_string_lossy(),
            }));
        }
    }
    for p in &plan {
        let rel = p["path"].as_str().unwrap_or("");
        let abs = Path::new(&pf_target).join(rel);
        if abs.is_file() {
            if let Ok(raw) = std::fs::read_to_string(&abs) {
                for h in scan_literals(&raw) {
                    failed.push(json!({
                        "code": "literal-denied",
                        "what": format!("literal-denied: {} contem '{}'", rel, h),
                        "fix": "remova a dependencia/uso da stack alheia.",
                        "where": abs.to_string_lossy(),
                    }));
                }
            }
        }
    }

    // D5 manifesto existente (leitura pura).
    let mpath = Path::new(&pf_target).join(registry::MANIFEST_NAME);
    let present = mpath.exists();
    let parsed = read_manifest(&pf_target);
    let mtime = std::fs::metadata(&mpath).ok().and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64);
    let manifest_info = json!({
        "present": present,
        "path": mpath.to_string_lossy(),
        "mtimeMs": mtime,
        "parsed": parsed,
    });

    let has_flag = plan.iter().any(|p| p["action"] == "flag");
    let has_merge = plan.iter().any(|p| p["action"] == "merge");
    let has_failed = !failed.is_empty();
    let (verdict, exit_code, next): (&str, i64, String) = if has_flag || has_failed {
        ("QUEBRADO", 1, "resolva cada item flag/FAIL acima e rode o fluxo de escrita de novo.".to_string())
    } else if has_merge {
        ("ATENÇÃO", 1, "revise os itens merge acima e rode o fluxo de escrita de novo.".to_string())
    } else {
        ("SAUDÁVEL", 0, format!("nada a corrigir; para instalar do zero rode init --target {}.", pf_target))
    };
    let next_value = Value::String(next);
    let report = json!({
        "verdict": verdict,
        "counts": counts,
        "next": next_value,
        "total": plan.len(),
        "failed": failed.len(),
    });

    // detect (D2) — leitura de pubspec.yaml.
    let detection = detect(&pf_target);

    Ok(json!({
        "target": pf_target,
        "markers": ["D0", "D1", "D2", "D3", "D4", "D5", "D6"],
        "inventory": inv,
        "detection": detection,
        "plan": plan,
        "checks": { "passed": !has_failed, "failed": failed },
        "manifestInfo": manifest_info,
        "manifest": manifest_info,
        "report": report,
        "verdict": verdict,
        "exitCode": exit_code,
    }))
}

fn detect(target: &str) -> Value {
    let path = Path::new(target).join("pubspec.yaml");
    let has = path.is_file();
    let mut result = json!({
        "hasPubspec": has, "name": Value::Null, "sdk": Value::Null,
        "declaresFlutter": false, "suggestedStack": Value::Null,
        "sources": [], "warnings": [],
    });
    if !has { return result; }
    let Ok(raw) = std::fs::read_to_string(&path) else {
        result["warnings"] = json!(["pubspec.yaml: ilegivel"]);
        return result;
    };
    let mut declares_flutter = false;
    for (i, line) in raw.lines().enumerate() {
        let t = line.split('#').next().unwrap_or("").trim();
        if t.starts_with("flutter:") || t == "sdk: flutter" || t.starts_with("sdk: flutter ") {
            declares_flutter = true;
            result["sources"] = json!([{ "field": "stack", "file": "pubspec.yaml", "line": i + 1 }]);
        }
    }
    result["declaresFlutter"] = json!(declares_flutter);
    result["suggestedStack"] = json!(if declares_flutter { "flutter" } else { "dart" });
    result
}

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target = str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    let source_dir = str_arg(req, "sourceDir");
    let answers_file = str_arg(req, "answersFile");
    let backup_dir = str_arg(req, "backupDir").or(str_arg(req, "backupRoot"));
    let allow_root = req.args.get("allowRoot").and_then(|v| v.as_bool()).unwrap_or(false);
    analyze(target, source_dir, answers_file, backup_dir, allow_root)
}
