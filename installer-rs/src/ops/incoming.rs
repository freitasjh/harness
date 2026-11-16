// collectIncoming — oráculo install.mjs:1697-1759 @ c63e333. 0 writes.
use crate::contract::Request;
use crate::error::EngineError;
use crate::ops::pathutil::str_arg;
use crate::ops::registry;
use serde_json::{Map, Value};
use std::path::Path;

fn read_vendor_lock(src: &str) -> Option<Value> {
    let p = Path::new(src).join(".agents").join("skills").join(registry::VENDOR_LOCK_NAME);
    std::fs::read_to_string(p).ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(|v| v.is_object())
}

fn excluded(rel: &str) -> bool {
    if rel.split('/').any(|seg| registry::INCOMING_EXCLUDE.contains(&seg)) { return true; }
    if rel == "scripts" || rel.starts_with("scripts/") { return true; }
    if rel.starts_with(registry::CONSUMER_EXCLUDED_PREFIX) { return true; }
    let base = rel.rsplit('/').next().unwrap_or("");
    base == registry::MANIFEST_NAME || base == registry::VENDOR_LOCK_NAME
}

fn skill_allowed_for_stacks(rel: &str, lock: &Option<Value>, wanted: &[String]) -> bool {
    let prefix = ".agents/skills/";
    if !rel.starts_with(prefix) || lock.is_none() { return true; }
    let name = rel[prefix.len()..].split('/').next().unwrap_or("");
    if name.is_empty() { return true; }
    let entry = lock.as_ref().and_then(|l| l.get("skills")).and_then(|s| s.get(name));
    let Some(entry) = entry else { return true; };
    let stacks: Vec<&str> = entry.get("stacks").and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str()).collect()).unwrap_or_default();
    stacks.is_empty() || stacks.iter().any(|s| wanted.iter().any(|w| w == s))
}

fn map_blocks(rel: &str, axis_keys: &[String], map: &[(&str, &[&str])], prefix: &str) -> bool {
    if !rel.starts_with(prefix) { return true; }
    let name = rel[prefix.len()..].split('/').next().unwrap_or("");
    if name.is_empty() { return true; }
    for (key, names) in map {
        if axis_keys.iter().any(|k| k == key) && names.contains(&name) { return false; }
    }
    true
}

fn skill_allowed_for_local(rel: &str, lock: &Option<Value>, axis_keys: &[String]) -> bool {
    let prefix = ".agents/skills/";
    if !rel.starts_with(prefix) { return true; }
    let name = rel[prefix.len()..].split('/').next().unwrap_or("");
    if name.is_empty() { return true; }
    let locked = lock.as_ref().and_then(|l| l.get("skills")).and_then(|s| s.get(name)).is_some();
    if locked { return true; }
    map_blocks(rel, axis_keys, &registry::SKILLS_BY_AXIS, prefix)
}

fn rule_allowed(rel: &str, axis_keys: &[String]) -> bool {
    map_blocks(rel, axis_keys, &registry::RULES_BY_AXIS, ".agents/rules/")
}

pub fn collect(req: &Request) -> Result<Value, EngineError> {
    let source = str_arg(req, "sourceDir").or(str_arg(req, "target")).unwrap_or("");
    let src = crate::ops::pathutil::resolve_path(source);
    let lock = read_vendor_lock(&src);
    let wanted: Vec<String> = req.args.get("stacks").and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let stack = req.args.get("stack").and_then(|v| v.as_str()).filter(|s| !s.is_empty());
    let axis_keys: Vec<String> = if let Some(s) = stack {
        registry::profile_of(s)
            .map(|p| registry::axis_keys(Some(p.backend_axis), Some(p.frontend_axis)))
            .unwrap_or_default()
    } else {
        let mut keys = Vec::new();
        for value in &wanted {
            if let Some(p) = registry::profile_of(value) {
                for k in registry::axis_keys(Some(p.backend_axis), Some(p.frontend_axis)) {
                    if !keys.contains(&k) { keys.push(k); }
                }
            }
        }
        keys
    };

    let mut incoming = Map::new();
    fn walk(
        abs: &Path, rel: &str, out: &mut Map<String, Value>, lock: &Option<Value>,
        wanted: &[String], axis_keys: &[String],
    ) {
        let Ok(md) = std::fs::symlink_metadata(abs) else { return };
        if md.is_dir() {
            if let Ok(entries) = std::fs::read_dir(abs) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let child_rel = if rel.is_empty() { name } else { format!("{}/{}", rel, name) };
                    walk(&entry.path(), &child_rel, out, lock, wanted, axis_keys);
                }
            }
        } else if md.is_file() {
            if !excluded(rel)
                && skill_allowed_for_stacks(rel, lock, wanted)
                && skill_allowed_for_local(rel, lock, axis_keys)
                && rule_allowed(rel, axis_keys)
            {
                if let Ok(body) = std::fs::read_to_string(abs) {
                    out.insert(rel.to_string(), Value::String(body));
                }
            }
        }
    }

    for root in registry::INCOMING_ROOTS {
        let abs = Path::new(&src).join(root);
        if !abs.exists() { continue; }
        if abs.is_dir() {
            walk(&abs, root, &mut incoming, &lock, &wanted, &axis_keys);
        } else if !excluded(root) {
            if let Ok(body) = std::fs::read_to_string(&abs) {
                incoming.insert(root.to_string(), Value::String(body));
            }
        }
    }

    Ok(Value::Object(incoming))
}
