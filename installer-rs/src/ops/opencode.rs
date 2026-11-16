// mergeOpencodeJson (install.mjs:927-973 @ c63e333). v2-only T1..T8:
// remoção de chave v1 POR FORMA, bloco gerenciado substituído, npm do usuário
// preservado, only-add em instructions/mcp. Nenhum preset/chave novo.
use serde_json::{json, Map, Value};

fn is_object(v: &Value) -> bool {
    v.is_object()
}

fn canonical(v: &Value) -> String {
    serde_json::to_string(v).unwrap_or_default()
}

pub fn is_harness_local_plugin_entry(entry: &Value) -> bool {
    let candidate = match entry {
        Value::String(s) => s.clone(),
        Value::Object(o) => {
            let mut found = String::new();
            for key in ["path", "source", "file"] {
                if let Some(s) = o.get(key).and_then(|v| v.as_str()) {
                    found = s.to_string();
                    break;
                }
            }
            found
        }
        _ => String::new(),
    };
    let norm = candidate
        .strip_prefix("./")
        .or_else(|| candidate.strip_prefix('/'))
        .unwrap_or(&candidate);
    norm.starts_with(".opencode/plugins/")
}

fn merge_plugin_list(existing: Option<&Value>, incoming: Option<&Value>) -> Vec<Value> {
    let mut out: Vec<Value> = Vec::new();
    let seq = |v: Option<&Value>| -> Vec<Value> {
        v.and_then(|x| x.as_array()).cloned().unwrap_or_default()
    };
    for e in seq(existing).into_iter().chain(seq(incoming)) {
        if is_harness_local_plugin_entry(&e) {
            continue;
        }
        if !out.iter().any(|o| canonical(o) == canonical(&e)) {
            out.push(e);
        }
    }
    out
}

fn strip_obsolete_v1(merged: &mut Map<String, Value>) {
    if merged.get("permissions").map(|v| !v.is_array()).unwrap_or(false) {
        merged.remove("permissions");
    }
    if let Some(agents) = merged.get("agents") {
        let v1 = agents.as_object().map(|m| {
            m.values().any(|e| {
                e.is_object() && e.as_object().map(|o| o.contains_key("tools")).unwrap_or(false)
            })
        });
        if !is_object(agents) || v1.unwrap_or(false) {
            merged.remove("agents");
        }
    }
    if merged.get("system").map(is_object).unwrap_or(false) {
        merged.remove("system");
    }
    if merged.get("server").map(is_object).unwrap_or(false) {
        merged.remove("server");
    }
}

pub fn merge_opencode_json(existing: &Value, incoming: &Value) -> (Value, bool) {
    let inc = incoming.as_object();
    let mut merged = existing.as_object().cloned().unwrap_or_default();
    let mut conflict = false;

    strip_obsolete_v1(&mut merged);

    // 2) bloco gerenciado (agent/permission): SUBSTITUÍDO pelo incoming.
    if let Some(inc) = inc {
        for k in ["agent", "permission"] {
            if let Some(v) = inc.get(k) {
                merged.insert(k.to_string(), v.clone());
            }
        }
    }

    // 3) plugin/plugins: lista de PACOTES npm do usuário — only-add menos o path local.
    if let Some(inc) = inc {
        for k in ["plugin", "plugins"] {
            if merged.get(k).map(|v| v.is_array()).unwrap_or(false) || inc.get(k).map(|v| v.is_array()).unwrap_or(false) {
                let list = merge_plugin_list(merged.get(k), inc.get(k));
                merged.insert(k.to_string(), Value::Array(list));
            }
        }
    }

    // 4) instructions: append only-add.
    if let Some(inc) = inc {
        let mut instr: Vec<Value> = merged
            .get("instructions")
            .and_then(|v| v.as_array()).cloned().unwrap_or_default();
        if let Some(inc_instr) = inc.get("instructions").and_then(|v| v.as_array()) {
            for i in inc_instr {
                if !instr.iter().any(|x| canonical(x) == canonical(i)) {
                    instr.push(i.clone());
                }
            }
        }
        if !instr.is_empty() {
            merged.insert("instructions".into(), Value::Array(instr));
        }
    }

    // 5) mcp: only-add; divergência ⇒ flag (nunca remove server).
    if let Some(inc) = inc {
        if let Some(inc_mcp) = inc.get("mcp") {
            match merged.get("mcp") {
                None => {
                    merged.insert("mcp".into(), inc_mcp.clone());
                }
                Some(host_mcp) => {
                    if canonical(host_mcp) != canonical(inc_mcp) {
                        conflict = true;
                    }
                    let host_req: Vec<Value> = host_mcp.get("required").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                    let inc_req = inc_mcp.get("required").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                    let mut union = host_req;
                    for r in inc_req {
                        if !union.iter().any(|x| canonical(x) == canonical(&r)) {
                            union.push(r);
                        }
                    }
                    let mut m = host_mcp.as_object().cloned().unwrap_or_default();
                    m.insert("required".into(), Value::Array(union));
                    merged.insert("mcp".into(), Value::Object(m));
                }
            }
        }
    }

    // 6) demais chaves do usuário: only-add.
    if let Some(inc) = inc {
        for (k, v) in inc {
            if ["plugin", "plugins", "instructions", "permission", "agent", "mcp"].contains(&k.as_str()) {
                continue;
            }
            if !merged.contains_key(k) {
                merged.insert(k.clone(), v.clone());
            }
        }
    }

    (Value::Object(merged), conflict)
}

pub fn run(req: &crate::contract::Request) -> Result<Value, crate::error::EngineError> {
    let existing = req.args.get("existing").cloned().unwrap_or_else(|| json!({}));
    let incoming = req.args.get("incoming").cloned().unwrap_or_else(|| json!({}));
    let (merged, conflict) = merge_opencode_json(&existing, &incoming);
    Ok(json!({ "merged": merged, "conflict": conflict }))
}
