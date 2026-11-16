// planMerge / applyMerge / assertCreateOnly / scan (install.mjs:980-1099,
// :1198-1249 @ c63e333). Remoção de chave v1 por forma (opencode.rs), only-add,
// apply é o ÚNICO ponto de escrita de conteúdo e só roda após backup verificado.
use crate::contract::Request;
use crate::error::EngineError;
use crate::ops::agent_file::merge_agent_file;
use crate::ops::opencode::merge_opencode_json;
use crate::ops::pathutil::{bool_arg, str_arg};
use serde_json::{json, Map, Value};
use std::path::Path;

pub const DENYLIST: [&str; 6] = ["taskflow", "vuetify", "primevue", "lombok", "mapstruct", "restassured"];
const SCAN_EXTENSIONS: [&str; 26] = [
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte", ".java", ".kt", ".kts",
    ".gradle", ".groovy", ".dart", ".cs", ".py", ".rb", ".go", ".rs", ".php", ".xml",
    ".json", ".yaml", ".yml", ".toml", ".properties", ".lock",
];

pub fn canonical(v: &Value) -> String {
    serde_json::to_string(v).unwrap_or_default()
}

pub fn layer_of(rel: &str) -> &'static str {
    if rel == "opencode.json" { return "opencode.json"; }
    if rel == "harness.config.json" { return "harness.config.json"; }
    for (prefix, layer) in [
        (".agents/agents/", ".agents/agents/*"),
        (".agents/rules/", ".agents/rules/*"),
        (".agents/schemas/", ".agents/schemas/*"),
        (".agents/skills/", ".agents/skills/*"),
        (".opencode/plugins/", ".opencode/plugins/*"),
    ] {
        if rel.starts_with(prefix) { return layer; }
    }
    "other"
}

pub fn is_scannable_path(rel: &str) -> bool {
    if rel.is_empty() { return false; }
    let norm = rel.replace('\\', "/");
    if norm.starts_with("scripts/") || norm.contains("/scripts/")
        || norm.starts_with("__tests__/") || norm.contains("/__tests__/")
    {
        return false;
    }
    let base = norm.rsplit('/').next().unwrap_or("").to_lowercase();
    if base == "dockerfile" { return true; }
    match base.rfind('.') {
        Some(dot) => SCAN_EXTENSIONS.contains(&&base[dot..]),
        None => false,
    }
}

pub fn scan_literals(content: &str) -> Vec<&'static str> {
    let lower = content.to_lowercase();
    DENYLIST.iter().copied().filter(|lit| lower.contains(lit)).collect()
}

fn read_text(abs: &Path) -> Option<String> {
    std::fs::read_to_string(abs).ok()
}

pub fn plan_merge(target: &str, incoming: &Map<String, Value>) -> Result<Vec<Value>, EngineError> {
    let plan = Vec::new();
    let t = target;
    let mut plan = plan;
    for (rel, content) in incoming {
        let layer = layer_of(rel);
        let abs = Path::new(t).join(rel);
        let content_str = content.as_str().unwrap_or("");

        if layer == "harness.config.json" {
            plan.push(json!({
                "path": rel, "layer": layer,
                "action": if abs.exists() { "generate-overwrite" } else { "create" },
                "reason": "generated from Q&A (ADR-002)",
            }));
            continue;
        }
        if !abs.exists() {
            plan.push(json!({ "path": rel, "layer": layer, "action": "create" }));
            continue;
        }
        let current = match read_text(&abs) {
            Some(s) => s,
            None => {
                plan.push(json!({ "path": rel, "layer": layer, "action": "flag", "reason": "unreadable existing file" }));
                continue;
            }
        };
        if current == content_str {
            plan.push(json!({ "path": rel, "layer": layer, "action": "noop" }));
            continue;
        }
        if rel == "opencode.json" {
            let parsed = match serde_json::from_str::<Value>(&current) {
                Ok(v) => v,
                Err(_) => return Err(EngineError::new("CORRUPT", format!("corrupt {}: invalid JSON, aborting (R1)", rel), "JSON ilegível", "corrija o JSON")),
            };
            let inc = match serde_json::from_str::<Value>(content_str) {
                Ok(v) => v,
                Err(_) => return Err(EngineError::new("CORRUPT", "incoming opencode.json invalid", "JSON ilegível", "corrija o incoming")),
            };
            let (merged, conflict) = merge_opencode_json(&parsed, &inc);
            if conflict {
                plan.push(json!({ "path": rel, "layer": layer, "action": "flag", "reason": "mcp divergence: human must resolve (only-add)" }));
                continue;
            }
            if canonical(&merged) == canonical(&parsed) {
                plan.push(json!({ "path": rel, "layer": layer, "action": "noop" }));
            } else {
                plan.push(json!({
                    "path": rel, "layer": layer, "action": "merge",
                    "reason": "v2-only merge: bloco gerenciado substituido, plugin/plugins so perdem o path local do harness, chave v1 removida por forma, instructions append",
                }));
            }
            continue;
        }
        if layer == ".agents/agents/*" {
            let r = merge_agent_file(&current, content_str);
            if r["action"] == "merge" {
                plan.push(json!({ "path": rel, "layer": layer, "action": "merge", "reason": "append Harness v7 section" }));
            } else {
                plan.push(json!({ "path": rel, "layer": layer, "action": "flag", "reason": r["reason"] }));
            }
            continue;
        }
        plan.push(json!({
            "path": rel, "layer": layer, "action": "flag",
            "reason": format!("{}: exists-different => flag (never auto-merge)", layer),
        }));
    }
    Ok(plan)
}

pub fn assert_create_only(plan: &[Value]) -> Result<Value, EngineError> {
    let offenders: Vec<&Value> = plan
        .iter()
        .filter(|p| matches!(p["action"].as_str(), Some("merge") | Some("flag")))
        .collect();
    if offenders.is_empty() {
        return Ok(json!({ "ok": true, "total": plan.len() }));
    }
    let mut kinds = Vec::new();
    for o in &offenders {
        let k = o["action"].as_str().unwrap_or("");
        if !kinds.contains(&k) { kinds.push(k); }
    }
    Err(EngineError::new(
        "flagged-open",
        format!("target nao-limpo: {} item(ns) {} — rode doctor / limpe o destino (create-only).", offenders.len(), kinds.join("|")),
        "create-only: merge/flag não passam",
        "rode doctor --target <dir> ou limpe o destino",
    ))
}

fn written_entry(rel: &str, strategy: &str, pre: Option<String>) -> Value {
    let mut m = Map::new();
    m.insert("path".into(), Value::String(rel.into()));
    m.insert("strategy".into(), Value::String(strategy.into()));
    if let Some(p) = pre {
        m.insert("preMergeSha256".into(), Value::String(crate::hash::sha256_hex(&p)));
    }
    Value::Object(m)
}

pub fn apply_merge(target: &str, plan: &[Value], incoming: &Map<String, Value>, dry_run: bool) -> Result<Value, EngineError> {
    let mut written = Vec::new();
    let mut flagged = Vec::new();
    if dry_run {
        for p in plan {
            if p["action"] == "flag" { flagged.push(p.clone()); }
        }
        return Ok(json!({ "written": written, "flagged": flagged, "planned": plan.len() }));
    }
    for step in plan {
        let rel = step["path"].as_str().unwrap_or("");
        let abs = Path::new(target).join(rel);
        match step["action"].as_str().unwrap_or("") {
            "noop" => continue,
            "flag" => { flagged.push(step.clone()); continue; }
            "create" | "generate-overwrite" => {
                let body = incoming.get(rel).and_then(|v| v.as_str()).ok_or_else(|| {
                    EngineError::new("MISSING_INCOMING", format!("missing incoming content for {}: refusing silent empty write (FU-21)", rel), "conteúdo ausente", "forneça incoming")
                })?;
                let pre = read_text(&abs);
                if let Some(parent) = abs.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                std::fs::write(&abs, body)
                    .map_err(|e| EngineError::new("CORRUPT", format!("write failed {}: {}", rel, e), "falha de gravação", "verifique permissões"))?;
                written.push(written_entry(rel, step["action"].as_str().unwrap_or(""), pre));
            }
            "merge" => {
                let incoming_body = incoming.get(rel).and_then(|v| v.as_str()).ok_or_else(|| {
                    EngineError::new("MISSING_INCOMING", format!("missing incoming content for {}: refusing silent empty write (FU-21)", rel), "conteúdo ausente", "forneça incoming")
                })?;
                let current = read_text(&abs).unwrap_or_default();
                let body = if rel == "opencode.json" {
                    let a = serde_json::from_str::<Value>(&current).unwrap_or_else(|_| json!({}));
                    let b = serde_json::from_str::<Value>(incoming_body).unwrap_or_else(|_| json!({}));
                    let (merged, _) = merge_opencode_json(&a, &b);
                    serde_json::to_string_pretty(&merged).unwrap_or_default()
                } else {
                    merge_agent_file(&current, incoming_body)["content"].as_str().unwrap_or("").to_string()
                };
                if let Some(parent) = abs.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                std::fs::write(&abs, &body)
                    .map_err(|e| EngineError::new("CORRUPT", format!("write failed {}: {}", rel, e), "falha de gravação", "verifique permissões"))?;
                written.push(written_entry(rel, "merge", Some(current)));
            }
            _ => {}
        }
    }
    Ok(json!({ "written": written, "flagged": flagged }))
}

// planUpgrade (install.mjs:2814-2876 @ c63e333) — INTERNO ao binário
// (não é `op` no dispatcher, ADR-001 §5). Overwrite gerenciado: disk != manifest
// ⇒ flag; paths do manifest ausentes do incoming ⇒ delete/flag.
pub fn plan_upgrade(target: &str, incoming: &Map<String, Value>, prev: &Value) -> Result<Vec<Value>, EngineError> {
    let hashes = crate::ops::manifest::manifest_file_hashes(prev);
    let mut plan = Vec::new();
    for (rel, content) in incoming {
        let abs = Path::new(target).join(rel);
        let content_str = content.as_str().unwrap_or("");
        if !abs.exists() {
            plan.push(json!({"path": rel, "layer": layer_of(rel), "action": "create", "reason": "incoming-new"}));
            continue;
        }
        let current = read_text(&abs);
        if current.as_deref() == Some(content_str) {
            plan.push(json!({"path": rel, "layer": layer_of(rel), "action": "noop", "reason": "identical"}));
            continue;
        }
        let disk_hash = current.as_ref().map(|s| crate::hash::sha256_hex(s));
        let expected = hashes.get(rel).and_then(|v| v.as_str());
        let user_modified = match expected {
            Some(e) => disk_hash.as_deref() != Some(e),
            None => true,
        };
        if user_modified {
            plan.push(json!({"path": rel, "layer": layer_of(rel), "action": "flag", "reason": "user-modified (disk != manifest)"}));
            continue;
        }
        let layer = layer_of(rel);
        let (action, reason) = if rel == "opencode.json" || layer == "opencode.json" {
            ("merge", "managed merge (upgrade)")
        } else if rel == "harness.config.json" || layer == "harness.config.json" {
            ("generate-overwrite", "generated from Q&A (ADR-002)")
        } else {
            ("overwrite", "managed overwrite (upgrade)")
        };
        plan.push(json!({"path": rel, "layer": layer, "action": action, "reason": reason}));
    }
    for (rel, hash) in &hashes {
        if incoming.contains_key(rel) { continue; }
        let abs = Path::new(target).join(rel);
        if !abs.exists() { continue; }
        let disk = read_text(&abs).map(|s| crate::hash::sha256_hex(&s));
        if disk.as_deref() == hash.as_str() {
            plan.push(json!({"path": rel, "layer": layer_of(rel), "action": "delete", "reason": "removed from incoming (unmodified)"}));
        } else {
            plan.push(json!({"path": rel, "layer": layer_of(rel), "action": "flag", "reason": "user-modified (disk != manifest)"}));
        }
    }
    Ok(plan)
}

// applyUpgrade (install.mjs:2878-2931 @ c63e333) — único ponto de escrita do
// upgrade; flag nunca escrito; delete só em path não modificado.
pub fn apply_upgrade(target: &str, plan: &[Value], incoming: &Map<String, Value>, dry_run: bool) -> Result<Value, EngineError> {
    let mut written = Vec::new();
    let mut flagged = Vec::new();
    let mut removed = Vec::new();
    if dry_run {
        for p in plan { if p["action"] == "flag" { flagged.push(p.clone()); } }
        return Ok(json!({"written": written, "flagged": flagged, "removed": removed, "planned": plan.len()}));
    }
    for step in plan {
        let rel = step["path"].as_str().unwrap_or("");
        let abs = Path::new(target).join(rel);
        match step["action"].as_str().unwrap_or("") {
            "noop" => continue,
            "flag" => { flagged.push(step.clone()); continue; }
            "delete" => {
                if abs.exists() { let _ = std::fs::remove_file(&abs); }
                removed.push(Value::String(rel.into()));
                continue;
            }
            "merge" => {
                let body = incoming.get(rel).and_then(|v| v.as_str()).ok_or_else(|| EngineError::new("MISSING_INCOMING", format!("missing incoming content for {}", rel), "conteúdo ausente", "forneça incoming"))?;
                let current = read_text(&abs).unwrap_or_default();
                let out = if rel == "opencode.json" || layer_of(rel) == "opencode.json" {
                    let a = serde_json::from_str::<Value>(&current).unwrap_or_else(|_| json!({}));
                    let b = serde_json::from_str::<Value>(body).unwrap_or_else(|_| json!({}));
                    let (m, _) = merge_opencode_json(&a, &b);
                    serde_json::to_string_pretty(&m).unwrap_or_default()
                } else {
                    merge_agent_file(&current, body)["content"].as_str().unwrap_or("").to_string()
                };
                if let Some(p) = abs.parent() { let _ = std::fs::create_dir_all(p); }
                std::fs::write(&abs, out).map_err(|e| EngineError::new("CORRUPT", format!("write failed {}: {}", rel, e), "falha de gravação", "verifique permissões"))?;
                written.push(written_entry(rel, "merge", Some(current)));
                continue;
            }
            "create" | "generate-overwrite" | "overwrite" => {
                let body = incoming.get(rel).and_then(|v| v.as_str()).ok_or_else(|| EngineError::new("MISSING_INCOMING", format!("missing incoming content for {}", rel), "conteúdo ausente", "forneça incoming"))?;
                let pre = read_text(&abs);
                if let Some(p) = abs.parent() { let _ = std::fs::create_dir_all(p); }
                std::fs::write(&abs, body).map_err(|e| EngineError::new("CORRUPT", format!("write failed {}: {}", rel, e), "falha de gravação", "verifique permissões"))?;
                written.push(written_entry(rel, step["action"].as_str().unwrap_or(""), pre));
            }
            _ => {}
        }
    }
    Ok(json!({"written": written, "flagged": flagged, "removed": removed}))
}

pub fn run_plan(req: &Request) -> Result<Value, EngineError> {
    let target = str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    let incoming: Map<String, Value> = req.args.get("incomingFiles").and_then(|v| v.as_object()).cloned().unwrap_or_default();
    Ok(json!({ "plan": plan_merge(target, &incoming)? }))
}

pub fn run_apply(req: &Request) -> Result<Value, EngineError> {
    let target = str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    let incoming: Map<String, Value> = req.args.get("incomingFiles").and_then(|v| v.as_object()).cloned().unwrap_or_default();
    let plan: Vec<Value> = req.args.get("plan").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let dry = bool_arg(req, "dryRun");
    apply_merge(target, &plan, &incoming, dry)
}

pub fn run_assert(req: &Request) -> Result<Value, EngineError> {
    let plan: Vec<Value> = req.args.get("plan").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    assert_create_only(&plan)
}
