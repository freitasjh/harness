// generateConfig — oráculo install.mjs:759-820 @ c63e333. 0 writes.
// EXPECTED_STACKS permanece literal no oráculo; aqui só se projeta a config.
use crate::contract::Request;
use crate::error::EngineError;
use crate::ops::registry;
use serde_json::{json, Map, Value};

const DEFAULT_EVIDENCE_SCHEMA: &str = ".agents/schemas/harness-report.schema.json";
const HARNESS_OWNED_MODULEMAP_KEYS: [&str; 3] = ["plugins", "rules", "schemas"];

fn ref_will_exist(rel: &str, written: &[String]) -> bool {
    let norm = rel.replace('\\', "/");
    if written.iter().any(|p| p == &norm) { return true; }
    let prefix = format!("{}/", norm);
    written.iter().any(|p| p.starts_with(&prefix))
}

pub fn generate(req: &Request) -> Result<Value, EngineError> {
    let answers = req.args.get("answers").filter(|v| v.is_object()).cloned().unwrap_or(Value::Null);
    let project = answers.get("project").and_then(|v| v.as_str()).unwrap_or("");
    if project.is_empty() {
        return Err(EngineError::new("BAD_ANSWER", "answers.project required", "projeto ausente", "informe answers.project"));
    }
    let backend = answers.get("backend").and_then(|v| v.as_str());
    let frontend = answers.get("frontend").and_then(|v| v.as_str());
    if let (Some(b), Some(f)) = (backend, frontend) {
        if registry::preset_of_axes(b, f).is_none() {
            return Err(EngineError::new("BAD_ANSWER", format!("no preset for axes {}+{}", b, f), "sem preset", "escolha axes válidos"));
        }
    }

    let mut stack = answers.get("stack").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if stack.is_empty() {
        stack = match (backend, frontend) {
            (Some(b), Some(f)) => registry::preset_of_axes(b, f).unwrap_or("node").to_string(),
            _ => "node".to_string(),
        };
    }
    let profile = registry::profile_of(&stack);
    let default_suite = registry::default_suite(&stack);
    let suite = answers.get("suiteCommand").and_then(|v| v.as_str()).unwrap_or(default_suite);
    let mut commands = Map::new();
    commands.insert("suiteFull".into(), Value::String(suite.to_string()));
    commands.insert("unit".into(), Value::String(suite.to_string()));
    if let Some(a) = profile.and_then(|p| p.analyze) {
        commands.insert("analyze".into(), Value::String(a.to_string()));
    }

    let mut module_map = Map::new();
    module_map.insert("plugins".into(), Value::String(".opencode/plugins".into()));
    module_map.insert("rules".into(), Value::String(".agents/rules".into()));
    module_map.insert("schemas".into(), Value::String(".agents/schemas".into()));
    if let Some(p) = profile {
        for (k, v) in p.module_map { module_map.insert((*k).into(), Value::String((*v).into())); }
    }

    let mut evidence = Map::new();
    evidence.insert("path".into(), Value::String("harness/".into()));
    evidence.insert("schema".into(), Value::String(DEFAULT_EVIDENCE_SCHEMA.into()));

    let written: Vec<String> = req.args.get("writtenPaths")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.replace('\\', "/"))).collect())
        .unwrap_or_default();
    if req.args.get("writtenPaths").map(|v| !v.is_null()).unwrap_or(false) {
        for k in HARNESS_OWNED_MODULEMAP_KEYS {
            if let Some(rel) = module_map.get(k).and_then(|v| v.as_str()) {
                if !ref_will_exist(rel, &written) { module_map.remove(k); }
            }
        }
        if !ref_will_exist(DEFAULT_EVIDENCE_SCHEMA, &written) { evidence.remove("schema"); }
    }

    let mcp: Vec<Value> = profile
        .map(|p| p.mcp.iter().map(|m| Value::String((*m).into())).collect())
        .unwrap_or_else(|| vec![Value::String("chrome-devtools".into())]);
    let backend_text = profile
        .map(|p| p.backend.to_string())
        .unwrap_or_else(|| format!("{} backend (declared via Q&A)", stack));
    let frontend_text = profile
        .map(|p| p.frontend.to_string())
        .unwrap_or_else(|| format!("{} frontend (declared via Q&A)", stack));

    Ok(json!({
        "version": 1,
        "project": project,
        "stack": { "backend": backend_text, "frontend": frontend_text },
        "moduleMap": module_map,
        "commands": commands,
        "infra": { "composeFile": null, "ports": { "backend": null, "frontend": null } },
        "mcp": { "required": mcp },
        "protectedPaths": [
            ".opencode/plugins/**", ".agents/rules/**", ".agents/schemas/**", ".agents/agents/**", "opencode.json", "harness.config.json"
        ],
        "gates": { "picco": "enforce", "evidence": "enforce", "hitlBatch": "enforce", "e2eGreenfield": "warn" },
        "riskPaths": ["**/security/**", "**/auth/**"],
        "escalateOnRisk": { "e2eGreenfield": "enforce", "evidenceScenario": "required" },
        "contraproveTimeoutMs": 900000,
        "evidence": evidence,
    }))
}
