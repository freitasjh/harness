// HARN-BE-06 — teste ANTES da implementação (TDD).
// RF-09/RF-10 (ADR-003 itens 9/10): merge v2-only T1..T8, remoção de chave v1
// POR FORMA, npm do usuário preservado, only-add em mcp/instructions;
// 2ª execução `noop` em conteúdo/mtime/inode (BF-02b).
use harness_installer::ops::{merge, opencode};
use serde_json::{json, Map, Value};

#[test]
fn plan_merge_classifies_create_noop_flag_and_generate_overwrite() {
    let base = std::env::temp_dir().join("harness-be06-plan");
    let _ = std::fs::remove_dir_all(&base);
    std::fs::create_dir_all(base.join(".agents/rules")).unwrap();
    std::fs::write(base.join(".agents/rules/user.md"), "do usuario\n").unwrap();
    std::fs::write(base.join(".agents/rules/other.md"), "original\n").unwrap();
    std::fs::write(base.join("opencode.json"), "{\"agent\":{}}\n").unwrap();
    std::fs::write(base.join("harness.config.json"), "{}\n").unwrap();

    let mut inc = Map::new();
    inc.insert(".agents/rules/new.md".into(), Value::String("novo\n".into()));
    inc.insert(".agents/rules/user.md".into(), Value::String("do usuario\n".into()));
    inc.insert(".agents/rules/other.md".into(), Value::String("diferente\n".into()));
    inc.insert("harness.config.json".into(), Value::String("cfg".into()));
    let plan = merge::plan_merge(base.to_str().unwrap(), &inc).unwrap();
    let action = |path: &str| plan.iter().find(|p| p["path"] == path).unwrap()["action"].as_str().unwrap();
    assert_eq!(action(".agents/rules/new.md"), "create");
    assert_eq!(action(".agents/rules/user.md"), "noop");
    assert_eq!(action(".agents/rules/other.md"), "flag");
    assert_eq!(action("harness.config.json"), "generate-overwrite");
    let _ = std::fs::remove_dir_all(&base);
}

#[test]
fn merge_opencode_v2_only_removes_v1_by_shape_keeps_user_npm_and_only_adds() {
    let existing = json!({
        "permissions": { "subagent": {}, "shell": {} },
        "agents": { "x": { "tools": ["a"] } },
        "system": {"prompt": "v1"},
        "server": { "port": 1 },
        "plugin": ["npm-do-usuario", "./.opencode/plugins/local.js"],
        "instructions": ["instrucao do usuario"],
        "agent": { "description": "v1" },
        "$comment": "do usuario"
    });
    let incoming = json!({
        "agent": { "description": "v2", "permission": "allow" },
        "permission": { "read": true },
        "plugin": ["outro-npm"],
        "instructions": ["instrucao do harness"],
        "mcp": { "required": ["chrome-devtools"] },
        "version": "novo"
    });
    let (merged, conflict) = opencode::merge_opencode_json(&existing, &incoming);
    assert!(!conflict);
    assert!(merged.get("permissions").is_none(), "mapa v1 removido por FORMA");
    assert!(merged.get("agents").is_none(), "agents com tools removido por FORMA");
    assert!(merged.get("system").is_none());
    assert!(merged.get("server").is_none());
    assert_eq!(merged["agent"]["description"], "v2", "bloco gerenciado substituído");
    assert_eq!(merged["permission"]["read"], true);
    let plugins = merged["plugin"].as_array().unwrap();
    assert!(plugins.iter().any(|p| p == "npm-do-usuario"), "npm do usuário preservado");
    assert!(plugins.iter().any(|p| p == "outro-npm"), "only-add npm");
    assert!(!plugins.iter().any(|p| p.as_str().unwrap_or("").contains(".opencode/plugins/")), "path local do harness removido");
    let instr = merged["instructions"].as_array().unwrap();
    assert_eq!(instr.len(), 2, "instructions only-add");
    assert_eq!(merged["mcp"]["required"], json!(["chrome-devtools"]));
    assert_eq!(merged["$comment"], "do usuario", "chave do usuário preservada");
    assert_eq!(merged["version"], "novo", "chave nova do incoming apenas adicionada");
}

#[test]
fn native_user_maps_are_not_removed_by_shape_rule() {
    let existing = json!({
        "permissions": [{"action": "read", "resource": "*", "effect": "allow"}],
        "agents": { "user": { "description": "nativo" } }
    });
    let (merged, _) = opencode::merge_opencode_json(&existing, &json!({}));
    assert!(merged["permissions"].is_array(), "array nativo sobrevive");
    assert!(merged["agents"].is_object(), "mapa nativo sem tools sobrevive");
}

#[test]
fn mcp_conflict_flags_and_unions_without_removing_user_server() {
    let existing = json!({"mcp": {"required": ["meu-server"], "servers": {"meu": {}}}});
    let incoming = json!({"mcp": {"required": ["chrome-devtools"], "servers": {"outro": {}}}});
    let (merged, conflict) = opencode::merge_opencode_json(&existing, &incoming);
    assert!(conflict, "divergência de mcp ⇒ flag");
    let req = merged["mcp"]["required"].as_array().unwrap();
    assert!(req.iter().any(|r| r == "meu-server"));
    assert!(req.iter().any(|r| r == "chrome-devtools"));
    assert!(merged["mcp"]["servers"]["meu"].is_object(), "server do usuário nunca removido");
}

#[test]
fn apply_merge_then_second_plan_is_noop_in_content_mtime_inode() {
    use std::os::unix::fs::MetadataExt;
    let base = std::env::temp_dir().join("harness-be06-idempotent");
    let _ = std::fs::remove_dir_all(&base);
    std::fs::create_dir_all(&base).unwrap();
    let mut inc = Map::new();
    inc.insert("opencode.json".into(), Value::String("{\"agent\":{}}\n".into()));
    let plan = merge::plan_merge(base.to_str().unwrap(), &inc).unwrap();
    let applied = merge::apply_merge(base.to_str().unwrap(), &plan, &inc, false).unwrap();
    assert_eq!(applied["written"].as_array().unwrap().len(), 1);

    let file = base.join("opencode.json");
    let m1 = std::fs::metadata(&file).unwrap();
    let plan2 = merge::plan_merge(base.to_str().unwrap(), &inc).unwrap();
    assert!(plan2.iter().all(|p| p["action"] == "noop"), "2ª execução: noop (BF-02b)");
    let _applied2 = merge::apply_merge(base.to_str().unwrap(), &plan2, &inc, false).unwrap();
    let m2 = std::fs::metadata(&file).unwrap();
    assert_eq!(m1.ino(), m2.ino(), "inode intacto");
    assert_eq!(m1.mtime(), m2.mtime(), "mtime intacto");
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "{\"agent\":{}}\n", "conteúdo intacto");
    let _ = std::fs::remove_dir_all(&base);
}

#[test]
fn build_manifest_is_schema_v1_and_write_manifest_dry_run_skips() {
    let m = harness_installer::ops::manifest::build_manifest(&json!({
        "target": "/tmp/harness-be06",
        "backupDir": "/tmp/harness-be06-backup",
        "answers": {"project": "demo", "stack": "node", "deployToken": "SEGREDO_BE06"},
        "fileContents": {"opencode.json": "{}"},
        "installed": [{"path": "opencode.json", "kind": "file"}],
    }));
    assert_eq!(m["manifestSchemaVersion"], 1);
    assert_eq!(m["source"], "harness@0.1.0");
    assert_eq!(m["fileHashes"][0]["path"], "opencode.json");
    assert_eq!(m["fileHashes"][0]["sha256"].as_str().unwrap().len(), 64);
    assert!(m["answers"].get("deployToken").is_none(), "segredo fora do manifesto");
    assert_eq!(m["validationMarks"].as_array().unwrap().len(), m["answers"].as_object().unwrap().len());

    let dry = harness_installer::ops::write::write_manifest("/tmp/nao-existe", &m, true);
    assert_eq!(dry["skipped"], true);
    assert!(dry["path"].is_null());
}

#[test]
fn dispatcher_wires_all_batch2_ops() {
    // Hermético: inspeciona o código do dispatcher (nenhuma op é DISPATCHADA
    // aqui — despachar `backup` com args vazios criaria diretório no CWD).
    let src = include_str!("../src/dispatcher.rs");
    assert!(!src.contains("=> pending"), "nenhuma op pode ficar no marcador pending");
    for op in harness_installer::dispatcher::OP_NAMES {
        assert!(src.contains(&format!("case \"{}\"", op)), "op {} sem braço no dispatcher", op);
    }
    assert_eq!(harness_installer::dispatcher::OP_NAMES.len(), 23);
}
