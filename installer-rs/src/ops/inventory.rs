// Oráculo: install.mjs:93-129 @ c63e333 (LAYER_PREFIX e layerPresent). 0 writes.
use crate::contract::Request;
use crate::error::EngineError;
use crate::ops::pathutil::{resolve_path, str_arg};
use serde_json::{json, Value};
use std::path::Path;

const LAYER_PREFIX: [&str; 7] = [
    "opencode.json",
    ".agents/agents",
    ".agents/rules",
    ".agents/schemas",
    ".agents/skills",
    ".opencode/plugins",
    "harness.config.json",
];

fn layer_present(t: &str, layer: &str) -> bool {
    if layer == "opencode.json" || layer == "harness.config.json" {
        return Path::new(t).join(layer).exists();
    }
    let dir = Path::new(t).join(layer);
    if !dir.exists() {
        return false;
    }
    std::fs::read_dir(dir)
        .map(|mut it| it.next().is_some())
        .unwrap_or(false)
}

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target = str_arg(req, "target")
        .or(req.target.as_deref())
        .unwrap_or("");
    let resolved = resolve_path(target);
    let layers: Vec<Value> = LAYER_PREFIX
        .iter()
        .map(|layer| json!({ "layer": layer, "present": layer_present(&resolved, layer) }))
        .collect();
    Ok(json!({ "target": resolved, "layers": layers }))
}
