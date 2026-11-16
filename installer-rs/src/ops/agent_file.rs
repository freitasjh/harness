// mergeAgentFile (install.mjs:975-978 @ c63e333). Seção Harness v7 anexada
// (normalizada) ou flag se já presente. Nenhuma prosa é inventada.
use serde_json::{json, Value};

fn normalize_section(s: &str) -> String {
    s.to_lowercase().split_whitespace().collect::<Vec<&str>>().join(" ")
}

fn has_harness_section(content: &str) -> bool {
    let target = normalize_section("## Harness v7");
    content.lines().any(|l| normalize_section(l) == target)
}

pub fn merge_agent_file(existing: &str, incoming_section: &str) -> Value {
    if has_harness_section(existing) {
        json!({
            "action": "flag",
            "content": existing,
            "reason": "Harness v7 section already present",
        })
    } else {
        let trimmed = existing.trim_end();
        json!({
            "action": "merge",
            "content": format!("{}\n\n{}", trimmed, incoming_section),
        })
    }
}

pub fn run(req: &crate::contract::Request) -> Result<Value, crate::error::EngineError> {
    let existing = req.args.get("existing").and_then(|v| v.as_str()).unwrap_or("");
    let incoming = req.args.get("incomingSection").and_then(|v| v.as_str()).unwrap_or("");
    Ok(merge_agent_file(existing, incoming))
}
