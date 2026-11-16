// HARN-BE-02 — teste ANTES da implementação (TDD).
// Ops 1/2/4/5: preflight, inventory, resolveBackupDir, loadAnswersFile.
// Oráculo: installer/install.mjs:52-90, :111-129, :146-165, :1785-1797 @ c63e333.
// NENHUMA destas ops escreve em disco (I3/I5).
use harness_installer::contract::{parse_request, Request};
use serde_json::{json, Value};

fn req(op: &str, args: Value) -> Request {
    let text = format!(
        "{{\"v\":1,\"op\":\"{}\",\"args\":{},\"answers\":{{}},\"target\":null}}",
        op, args
    );
    parse_request(&text).unwrap()
}

fn code(err: harness_installer::error::EngineError) -> String {
    err.code
}

#[test]
fn preflight_ok_returns_resolved_target_and_uid() {
    let r = req(
        "preflight",
        json!({"target": "/tmp/harness-be02-target", "uid": 1000, "nodeVersion": "20.0.0", "skipManifestGuard": true}),
    );
    let out = harness_installer::ops::preflight::run(&r).unwrap();
    assert_eq!(out["target"], "/tmp/harness-be02-target");
    assert_eq!(out["uid"], 1000);
}

#[test]
fn preflight_bad_target_is_bad_target() {
    let r = req("preflight", json!({"target": "", "uid": 1000, "nodeVersion": "20.0.0", "skipManifestGuard": true}));
    assert_eq!(code(harness_installer::ops::preflight::run(&r).unwrap_err()), "BAD_TARGET");
}

#[test]
fn preflight_dotdot_is_outside_target() {
    let r = req("preflight", json!({"target": "/tmp/a/../b", "uid": 1000, "nodeVersion": "20.0.0", "skipManifestGuard": true}));
    assert_eq!(code(harness_installer::ops::preflight::run(&r).unwrap_err()), "OUTSIDE_TARGET");
}

#[test]
fn preflight_node_min_is_node_min() {
    let r = req("preflight", json!({"target": "/tmp/x", "uid": 1000, "nodeVersion": "18.0.0", "skipManifestGuard": true}));
    assert_eq!(code(harness_installer::ops::preflight::run(&r).unwrap_err()), "NODE_MIN");
}

#[test]
fn preflight_uid_root_is_uid_root() {
    let r = req("preflight", json!({"target": "/tmp/x", "uid": 0, "nodeVersion": "20.0.0", "skipManifestGuard": true}));
    assert_eq!(code(harness_installer::ops::preflight::run(&r).unwrap_err()), "UID_ROOT");
}

#[test]
fn preflight_existing_own_manifest_is_reinstall() {
    let dir = std::env::temp_dir().join("harness-be02-reinstall");
    let _ = std::fs::create_dir_all(&dir);
    std::fs::write(
        dir.join(".harness-install.json"),
        r#"{"manifestSchemaVersion":1,"source":"ok"}"#,
    )
    .unwrap();
    let r = req(
        "preflight",
        json!({"target": dir.to_str().unwrap(), "uid": 1000, "nodeVersion": "20.0.0", "skipManifestGuard": false}),
    );
    assert_eq!(code(harness_installer::ops::preflight::run(&r).unwrap_err()), "REINSTALL");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn inventory_absent_target_has_seven_layers_present_false() {
    let r = req("inventory", json!({"target": "/tmp/harness-be02-inventory-absent"}));
    let out = harness_installer::ops::inventory::run(&r).unwrap();
    let layers = out["layers"].as_array().unwrap();
    assert_eq!(layers.len(), 7);
    assert!(layers.iter().all(|l| l["present"] == false));
    assert_eq!(
        layers[0]["layer"],
        "opencode.json",
        "ordem de LAYER_PREFIX congelada (install.mjs:93-101)"
    );
}

#[test]
fn resolve_backup_dir_disjoint_returns_absolute_dir() {
    let r = req(
        "resolveBackupDir",
        json!({"target": "/tmp/harness-be02-t", "backupRoot": "/tmp/harness-be02-b"}),
    );
    let out = harness_installer::ops::backup_dir::run(&r).unwrap();
    assert_eq!(out, json!("/tmp/harness-be02-b"));
}

#[test]
fn resolve_backup_dir_equal_and_nested_are_backup_fail() {
    for (t, b) in [
        ("/tmp/harness-be02-same", "/tmp/harness-be02-same"),
        ("/tmp/harness-be02-parent", "/tmp/harness-be02-parent/child"),
        ("/tmp/harness-be02-inner/child", "/tmp/harness-be02-inner"),
    ] {
        let r = req("resolveBackupDir", json!({"target": t, "backupRoot": b}));
        assert_eq!(
            code(harness_installer::ops::backup_dir::run(&r).unwrap_err()),
            "BACKUP_FAIL",
            "target={} backup={}",
            t,
            b
        );
    }
}

#[test]
#[cfg(unix)]
fn resolve_backup_dir_rejects_symlink_equal_and_nested() {
    use std::os::unix::fs::symlink;
    let base = std::env::temp_dir().join("harness-be02-symlink");
    let _ = std::fs::remove_dir_all(&base);
    std::fs::create_dir_all(base.join("t")).unwrap();
    std::fs::create_dir_all(base.join("t").join("child")).unwrap();
    std::fs::create_dir_all(base.join("b")).unwrap();

    // symlink → target: canonicalize iguais ⇒ BACKUP_FAIL.
    let link_equal = base.join("link_equal");
    symlink(base.join("t"), &link_equal).unwrap();
    let r = req(
        "resolveBackupDir",
        json!({"target": base.join("t").to_str().unwrap(), "backupRoot": link_equal.to_str().unwrap()}),
    );
    assert_eq!(code(harness_installer::ops::backup_dir::run(&r).unwrap_err()), "BACKUP_FAIL", "symlink igual ao target");

    // symlink → filho do target: canonicalize aninhado ⇒ BACKUP_FAIL.
    let link_nested = base.join("link_nested");
    symlink(base.join("t").join("child"), &link_nested).unwrap();
    let r = req(
        "resolveBackupDir",
        json!({"target": base.join("t").to_str().unwrap(), "backupRoot": link_nested.to_str().unwrap()}),
    );
    assert_eq!(code(harness_installer::ops::backup_dir::run(&r).unwrap_err()), "BACKUP_FAIL", "symlink dentro do target");

    // symlink → diretório externo distinto: permitido (canonicalize externo).
    let link_ok = base.join("link_ok");
    symlink(base.join("b"), &link_ok).unwrap();
    let r = req(
        "resolveBackupDir",
        json!({"target": base.join("t").to_str().unwrap(), "backupRoot": link_ok.to_str().unwrap()}),
    );
    assert!(harness_installer::ops::backup_dir::run(&r).is_ok(), "symlink externo é válido");

    let _ = std::fs::remove_dir_all(&base);
}

#[test]
fn load_answers_file_ok_parses_object() {
    let p = std::env::temp_dir().join("harness-be02-answers.json");
    std::fs::write(&p, r#"{"project":"demo","stack":"node"}"#).unwrap();
    let r = req("loadAnswersFile", json!({"path": p.to_str().unwrap()}));
    let out = harness_installer::ops::answers::load(&r).unwrap();
    assert_eq!(out["project"], "demo");
    assert_eq!(out["stack"], "node");
    let _ = std::fs::remove_file(&p);
}

#[test]
fn load_answers_file_missing_or_bad_json_is_bad_answer() {
    let r = req("loadAnswersFile", json!({"path": "/tmp/harness-be02-nao-existe.json"}));
    assert_eq!(code(harness_installer::ops::answers::load(&r).unwrap_err()), "BAD_ANSWER");
    let p = std::env::temp_dir().join("harness-be02-bad-answers.json");
    std::fs::write(&p, "not json").unwrap();
    let r = req("loadAnswersFile", json!({"path": p.to_str().unwrap()}));
    assert_eq!(code(harness_installer::ops::answers::load(&r).unwrap_err()), "BAD_ANSWER");
    let _ = std::fs::remove_file(&p);
}
