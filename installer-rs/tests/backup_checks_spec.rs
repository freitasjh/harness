// HARN-BE-07 — teste ANTES da implementação (TDD).
// RF-04 (ADR-003 item 4 / I2/FU-20): backup verificado antes do apply;
// injectFailure ⇒ BACKUP_FAIL, 0 writes, hash do destino idêntico; checks
// depois do apply; nenhuma escrita de conteúdo sem verified === true.
use harness_installer::contract::{parse_request, Request};
use harness_installer::ops::{backup, checks};
use serde_json::{json, Value};
use std::collections::BTreeMap;

fn req(args: Value) -> Request {
    let text = format!("{{\"v\":1,\"op\":\"x\",\"args\":{},\"answers\":{{}}}}", args);
    parse_request(&text).unwrap()
}

fn tree_hash(dir: &std::path::Path) -> Vec<(String, Vec<u8>)> {
    fn walk(base: &std::path::Path, dir: &std::path::Path, out: &mut BTreeMap<String, Vec<u8>>) {
        if let Ok(rd) = std::fs::read_dir(dir) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir() { walk(base, &p, out); }
                else if p.is_file() {
                    out.insert(p.strip_prefix(base).unwrap().to_string_lossy().to_string(), std::fs::read(&p).unwrap_or_default());
                }
            }
        }
    }
    let mut m = BTreeMap::new();
    walk(dir, dir, &mut m);
    m.into_iter().collect()
}

#[test]
fn backup_inject_failure_has_zero_writes_and_identical_destination() {
    let base = std::env::temp_dir().join("harness-be07-backup-fail");
    let _ = std::fs::remove_dir_all(&base);
    std::fs::create_dir_all(&base).unwrap();
    std::fs::write(base.join("opencode.json"), "{\"agent\":{}}\n").unwrap();
    let before = tree_hash(&base);

    let err = backup::backup(base.to_str().unwrap(), Some("/tmp/harness-be07-backup-fail-dir"), true).unwrap_err();
    assert_eq!(err.code, "BACKUP_FAIL");
    assert_eq!(tree_hash(&base), before, "0 writes no destino");
    assert!(!std::path::Path::new("/tmp/harness-be07-backup-fail-dir").exists(), "nenhum diretório de backup criado");
    let _ = std::fs::remove_dir_all(&base);
}

#[test]
fn backup_happy_copies_tracked_layers_and_is_verified() {
    let base = std::env::temp_dir().join("harness-be07-backup-ok");
    let bdir = std::env::temp_dir().join("harness-be07-backup-ok-dir");
    let _ = std::fs::remove_dir_all(&base);
    let _ = std::fs::remove_dir_all(&bdir);
    std::fs::create_dir_all(base.join(".agents/rules")).unwrap();
    std::fs::write(base.join("opencode.json"), "{\"a\":1}\n").unwrap();
    std::fs::write(base.join(".agents/rules/x.md"), "x\n").unwrap();

    let bk = backup::backup(base.to_str().unwrap(), Some(bdir.to_str().unwrap()), false).unwrap();
    assert_eq!(bk["verified"], true);
    assert_eq!(bk["backupDir"], bdir.to_str().unwrap());
    let copied = bk["copied"].as_array().unwrap();
    assert!(copied.iter().any(|c| c == "opencode.json"));
    assert!(copied.iter().any(|c| c == ".agents"));
    assert_eq!(std::fs::read_to_string(bdir.join("opencode.json")).unwrap(), "{\"a\":1}\n");
    assert!(std::path::Path::new(&bdir.join(".agents/rules/x.md")).is_file());

    let dir = backup::require_verified_backup(&bk).unwrap();
    assert_eq!(dir, bdir.to_str().unwrap());
    let _ = std::fs::remove_dir_all(&base);
    let _ = std::fs::remove_dir_all(&bdir);
}

#[test]
fn require_verified_backup_rejects_unverified() {
    for bk in [json!({}), json!({"verified": false, "backupDir": "/tmp/x"}), json!({"backupDir": "/tmp/x"})] {
        let err = backup::run_require(&req(json!({"backup": bk}))).unwrap_err();
        assert_eq!(err.code, "BACKUP_UNVERIFIED");
    }
}

#[test]
fn run_checks_reports_missing_manifest_json_invalid_and_flagged() {
    let base = std::env::temp_dir().join("harness-be07-checks");
    let _ = std::fs::remove_dir_all(&base);
    std::fs::create_dir_all(&base).unwrap();
    std::fs::write(base.join("opencode.json"), "not json").unwrap();
    let manifest = json!({
        "manifestSchemaVersion": 1,
        "flagged": [{"path": ".agents/rules/x.md", "reason": "exists-different"}],
        "installed": []
    });
    let out = checks::run_checks(base.to_str().unwrap(), Some(&manifest));
    assert_eq!(out["passed"], false);
    let codes: Vec<&str> = out["failed"].as_array().unwrap().iter().map(|f| f["code"].as_str().unwrap()).collect();
    assert!(codes.contains(&"json-invalid"), "checks detecta JSON corrompido");
    assert!(codes.contains(&"flagged-open"), "checks detecta flagged");
    assert!(codes.contains(&"manifest-missing"), "manifesto ausente no target");

    let no_manifest = checks::run_checks(base.to_str().unwrap(), None);
    assert_eq!(no_manifest["failed"].as_array().unwrap().len(), 1);
    let _ = std::fs::remove_dir_all(&base);
}

#[test]
fn dry_run_checks_never_publish_pass() {
    let c = checks::dry_run_checks();
    assert!(c["passed"].is_null());
    assert_eq!(c["ran"], false);
    assert_eq!(c["skipped"], true);
    assert!(c.get("reason").is_some());
}
