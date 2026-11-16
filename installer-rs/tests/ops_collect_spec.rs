// HARN-BE-03 — teste ANTES da implementação (TDD).
// Ops 6/7/8: collectAnswers, generateConfig, collectIncoming.
// Oráculo: install.mjs:667-717, :759-820, :1724-1759 @ c63e333.
// EXPECTED_STACKS continua LITERAL escrito à mão no oráculo (eixos-stack.spec.mjs:40):
// este teste NÃO deriva nada do binário sob teste.
use harness_installer::contract::{parse_request, Request};
use serde_json::{json, Value};

fn req(op: &str, args: Value) -> Request {
    let text = format!(
        "{{\"v\":1,\"op\":\"{}\",\"args\":{},\"answers\":{{\"deployToken\":\"SEGREDO_BE03\"}},\"target\":null}}",
        op, args
    );
    parse_request(&text).unwrap()
}

fn root() -> String {
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest.parent().unwrap().to_string_lossy().to_string()
}

fn code(err: harness_installer::error::EngineError) -> String { err.code }

#[test]
fn collect_answers_happy_returns_serialized_answers_without_secret() {
    let r = req(
        "collectAnswers",
        json!({"target": root(), "scripted": {
            "project": "demo", "stack": "node", "suiteCommand": "node --test", "pluginsDir": ".opencode/plugins"
        }}),
    );
    let out = harness_installer::ops::answers::collect(&r).unwrap();
    assert_eq!(out["project"], "demo");
    assert_eq!(out["stack"], "node");
    assert_eq!(out["suiteCommand"], "node --test");
    assert_eq!(out["pluginsDir"], format!("{}/.opencode/plugins", root()));
    assert!(out.get("deployToken").is_none(), "segredo nunca entra no envelope (I5)");
}

#[test]
fn collect_answers_rejects_paired_mismatch_and_missing_stack() {
    let r = req("collectAnswers", json!({"target": root(), "scripted": {"backend": "node", "project": "demo"}}));
    assert_eq!(code(harness_installer::ops::answers::collect(&r).unwrap_err()), "BAD_ANSWER");
    let r = req("collectAnswers", json!({"target": root(), "scripted": {"project": "demo"}}));
    assert_eq!(code(harness_installer::ops::answers::collect(&r).unwrap_err()), "BAD_ANSWER");
}

#[test]
fn collect_answers_rejects_unknown_stack() {
    let r = req("collectAnswers", json!({"target": root(), "scripted": {"project": "demo", "stack": "inexistente"}}));
    assert_eq!(code(harness_installer::ops::answers::collect(&r).unwrap_err()), "BAD_ANSWER");
}

const NON_MOBILE: [&str; 9] = [
    "node", "node-esm", "java+vue", "outra", "rust", "nestjs", "node+react", "nestjs+react", "rust+react",
];

fn generate(stack: &str) -> Value {
    let r = req(
        "generateConfig",
        json!({"answers": {"project": "demo", "stack": stack}, "writtenPaths": null}),
    );
    harness_installer::ops::config::generate(&r).unwrap()
}

#[test]
fn generate_config_node_matches_frozen_golden_shape() {
    let c = generate("node");
    assert_eq!(c["version"], 1);
    assert_eq!(c["project"], "demo");
    assert_eq!(c["commands"]["suiteFull"], "node --test");
    assert_eq!(c["commands"]["unit"], "node --test");
    assert_eq!(c["mcp"]["required"][0], "chrome-devtools");
    assert_eq!(c["moduleMap"]["plugins"], ".opencode/plugins");
    assert_eq!(c["evidence"]["schema"], ".agents/schemas/harness-report.schema.json");
    assert_eq!(c["contraproveTimeoutMs"], 900000);
    assert_eq!(c["gates"]["e2eGreenfield"], "warn");
    assert_eq!(c["infra"]["composeFile"], Value::Null);
}

#[test]
fn generate_config_nine_byte_equal_defaults_and_two_partials() {
    for stack in NON_MOBILE {
        let c = generate(stack);
        let expected = harness_installer::ops::registry::default_suite(stack);
        assert_eq!(c["commands"]["suiteFull"], expected, "stack={}", stack);
        assert_eq!(c["mcp"]["required"], json!(["chrome-devtools"]), "stack={}", stack);
    }
    let flutter = generate("flutter");
    assert_eq!(flutter["commands"]["analyze"], "dart analyze");
    assert_eq!(flutter["mcp"]["required"], json!(["marionette_mcp", "dart"]));
    assert_eq!(flutter["moduleMap"]["lib"], "lib");
    let dart = generate("dart");
    assert_eq!(dart["mcp"]["required"], json!(["dart"]));
    assert!(dart["moduleMap"].get("lib").is_some());
}

#[test]
fn generate_config_missing_project_is_bad_answer() {
    let r = req("generateConfig", json!({"answers": {"stack": "node"}}));
    assert_eq!(code(harness_installer::ops::config::generate(&r).unwrap_err()), "BAD_ANSWER");
}

fn collect(source: &str) -> Value {
    let r = req("collectIncoming", json!({"sourceDir": source, "stacks": [], "stack": null}));
    harness_installer::ops::incoming::collect(&r).unwrap()
}

#[test]
fn collect_incoming_reads_root_file_and_excludes_tooling() {
    let base = std::env::temp_dir().join("harness-be03-incoming");
    let _ = std::fs::remove_dir_all(&base);
    std::fs::create_dir_all(base.join("node_modules")).unwrap();
    std::fs::create_dir_all(base.join(".opencode/plugins/__tests__")).unwrap();
    std::fs::write(base.join("opencode.json"), "{\"agent\":{}}\n").unwrap();
    std::fs::write(base.join("node_modules/x.js"), "lixo").unwrap();
    std::fs::write(base.join(".opencode/plugins/__tests__/x.spec.mjs"), "lixo").unwrap();
    let out = collect(base.to_str().unwrap());
    assert_eq!(out["opencode.json"], "{\"agent\":{}}\n");
    assert!(out.get("node_modules/x.js").is_none());
    assert!(out.get(".opencode/plugins/__tests__/x.spec.mjs").is_none());
    let _ = std::fs::remove_dir_all(&base);
}
