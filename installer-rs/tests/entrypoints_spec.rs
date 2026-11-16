// HARN-BE-08 — teste ANTES da implementação (TDD).
// RF-03/05/09/10/11 (ADR-003 itens 3/5/9/10/11): 4 entrypoints, DUAS ordens
// congeladas (runUpgrade planeja antes de backup; main faz backup antes de
// planejar), dry-run 0 writes, init create-only, exitCode 0/1/2.
use harness_installer::contract::{parse_request, Request};
use serde_json::{json, Value};

fn req(op: &str, args: Value, answers: Value) -> Request {
    let text = format!(
        "{{\"v\":1,\"op\":\"{}\",\"args\":{},\"answers\":{},\"target\":{}}}",
        op, args, answers, json!(args.get("target").and_then(|v| v.as_str()).unwrap_or(""))
    );
    parse_request(&text).unwrap()
}

fn seed_installed(target: &std::path::Path) {
    let _ = std::fs::remove_dir_all(target);
    std::fs::create_dir_all(target.join(".agents/rules")).unwrap();
    std::fs::create_dir_all(target.join(".opencode/plugins")).unwrap();
    let opencode = "{\"agent\":{\"description\":\"v2\"}}\n";
    std::fs::write(target.join("opencode.json"), opencode).unwrap();
    std::fs::write(target.join("harness.config.json"), "{}\n").unwrap();
    let mut m = serde_json::Map::new();
    m.insert("opencode.json".into(), Value::String(harness_installer::hash::sha256_hex(opencode)));
    let manifest = json!({
        "manifestSchemaVersion": 1,
        "source": "harness@0.1.0",
        "answers": {"project": "demo", "stack": "node"},
        "fileHashes": Value::Object(m),
        "installed": [{"path": "opencode.json", "kind": "file"}],
    });
    std::fs::write(target.join(".harness-install.json"), serde_json::to_string_pretty(&manifest).unwrap()).unwrap();
}

fn tree_bytes(dir: &std::path::Path) -> Vec<(String, Vec<u8>)> {
    use std::collections::BTreeMap;
    fn walk(base: &std::path::Path, dir: &std::path::Path, m: &mut BTreeMap<String, Vec<u8>>) {
        if let Ok(rd) = std::fs::read_dir(dir) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir() { walk(base, &p, m); }
                else if p.is_file() {
                    m.insert(p.strip_prefix(base).unwrap().to_string_lossy().to_string(), std::fs::read(&p).unwrap_or_default());
                }
            }
        }
    }
    let mut m = BTreeMap::new();
    walk(dir, dir, &mut m);
    m.into_iter().collect()
}

#[test]
fn two_frozen_orders_upgrade_plans_before_backup_main_backs_up_before_plan() {
    let up = include_str!("../src/entry/upgrade.rs");
    let mn = include_str!("../src/entry/main.rs");
    let pos = |s: &str, pat: &str| s.find(pat).unwrap_or(usize::MAX);
    // runUpgrade: doctor → planUpgrade → backup
    assert!(pos(up, "doctor::analyze") < pos(up, "plan_upgrade"), "upgrade: doctor antes de planejar");
    assert!(pos(up, "plan_upgrade") < pos(up, "backup::backup"), "upgrade: PLANO antes de BACKUP");
    // main: backup → planMerge
    assert!(pos(mn, "backup::backup") < pos(mn, "plan_merge"), "main: BACKUP antes de PLANO");
    assert!(pos(mn, "checks::run_checks") > pos(mn, "apply_merge"), "checks depois do apply");
}

#[test]
fn run_upgrade_dry_run_plans_without_backup_and_zero_writes() {
    let target = std::env::temp_dir().join("harness-be08-upgrade-dry");
    seed_installed(&target);
    let before = tree_bytes(&target);
    let full = json!({"project": "demo", "stack": "node", "suiteCommand": "node --test", "pluginsDir": ".opencode/plugins", "deployToken": "s"});
    let r = req("runUpgrade", json!({"target": target.to_str().unwrap(), "dryRun": true, "yes": true}), full);
    let out = harness_installer::dispatcher::dispatch(&r).unwrap();
    let res = out.result.unwrap();
    assert_eq!(res["applied"], false);
    assert!(res["backupDir"].is_null());
    assert_eq!(res["checks"]["passed"], Value::Null);
    assert_eq!(res["checks"]["ran"], false);
    assert_eq!(res["checks"]["skipped"], true);
    assert_eq!(res["exitCode"], 0);
    assert_eq!(tree_bytes(&target), before, "dry-run: 0 writes (nem backup)");
    let _ = std::fs::remove_dir_all(&target);
}

#[test]
fn run_upgrade_with_flag_yields_collisions_and_continues() {
    let target = std::env::temp_dir().join("harness-be08-upgrade-flag-t");
    let src = std::env::temp_dir().join("harness-be08-upgrade-flag-s");
    seed_installed(&target);
    let _ = std::fs::remove_dir_all(&src);
    std::fs::create_dir_all(src.join(".agents/rules")).unwrap();
    std::fs::write(target.join(".agents/rules/user.md"), "versao do usuario\n").unwrap();
    std::fs::write(src.join(".agents/rules/user.md"), "versao do harness\n").unwrap();

    let full = json!({"project": "demo", "stack": "node", "suiteCommand": "node --test", "pluginsDir": ".opencode/plugins", "deployToken": "s"});
    let r = req("runUpgrade", json!({
        "target": target.to_str().unwrap(), "sourceDir": src.to_str().unwrap(), "yes": true
    }), full);
    let out = harness_installer::dispatcher::dispatch(&r).unwrap();
    let res = out.result.unwrap();
    assert_eq!(res["applied"], true, "flag NÃO aborta o upgrade");
    let collisions = res["collisions"].as_array().unwrap();
    assert!(collisions.iter().any(|c| c == ".agents/rules/user.md"), "flag virou collisions");
    assert_eq!(res["manifest"]["doctorPre"]["verdict"], "QUEBRADO");
    let _ = std::fs::remove_dir_all(&target);
    let _ = std::fs::remove_dir_all(&src);
}

#[test]
fn run_init_dirty_destination_is_flagged_open_exit_one_zero_writes() {
    let target = std::env::temp_dir().join("harness-be08-init-dirty-t");
    let src = std::env::temp_dir().join("harness-be08-init-dirty-s");
    let _ = std::fs::remove_dir_all(&target);
    let _ = std::fs::remove_dir_all(&src);
    std::fs::create_dir_all(target.join(".agents/rules")).unwrap();
    std::fs::create_dir_all(target.join(".opencode/plugins")).unwrap();
    std::fs::create_dir_all(src.join(".agents/rules")).unwrap();
    std::fs::write(target.join(".agents/rules/user.md"), "usuario\n").unwrap();
    std::fs::write(src.join(".agents/rules/user.md"), "harness\n").unwrap();
    let before = tree_bytes(&target);

    let r = req("runInit", json!({
        "target": target.to_str().unwrap(), "sourceDir": src.to_str().unwrap(),
        "answersFile": "/dev/null"
    }), json!({"project": "demo", "stack": "node", "suiteCommand": "node --test", "pluginsDir": ".opencode/plugins", "deployToken": "s"}));
    let out = harness_installer::dispatcher::dispatch(&r).unwrap();
    let err = out.error.expect("init sujo deve reprovar");
    assert_eq!(err.code, "flagged-open");
    assert!(err.fix.contains("doctor"), "dica aponta doctor");
    assert_eq!(tree_bytes(&target), before, "init abortado: 0 writes");
    let _ = std::fs::remove_dir_all(&target);
    let _ = std::fs::remove_dir_all(&src);
}

#[test]
fn exit_code_cross_table_four_call_sites() {
    // 0 = válido/dry-run; 1 = reprovado; 2 = SOMENTE protocolo.
    let target = std::env::temp_dir().join("harness-be08-exit");
    seed_installed(&target);
    let clean = std::env::temp_dir().join("harness-be08-exit-clean");
    let _ = std::fs::remove_dir_all(&clean);
    std::fs::create_dir_all(clean.join(".opencode/plugins")).unwrap();
    let full = json!({"project": "demo", "stack": "node", "suiteCommand": "node --test", "pluginsDir": ".opencode/plugins", "deployToken": "s"});
    for op in ["main", "runInit", "runUpgrade", "runCli"] {
        let t = if op == "runUpgrade" { target.to_str().unwrap() } else { clean.to_str().unwrap() };
        let mut args = json!({"target": t, "dryRun": true, "yes": true});
        if op == "runCli" {
            args["argv"] = json!(["--target", t, "--dry-run", "--yes"]);
        }
        let r = req(op, args, full.clone());
        let out = harness_installer::dispatcher::dispatch(&r).unwrap();
        let res = out.result.unwrap_or_else(|| panic!("{} deveria devolver resultado: {:?}", op, out.error));
        assert_eq!(res["exitCode"], 0, "{} dry-run ⇒ 0", op);
    }
    // 1: reprovado (backup injetado no main).
    let r = req("main", json!({"target": clean.to_str().unwrap(), "injectFailure": true}), full);
    let out = harness_installer::dispatcher::dispatch(&r).unwrap();
    assert_eq!(out.error.unwrap().code, "BACKUP_FAIL", "falha ⇒ exit 1");

    // 2: protocolo (v != 1) — nunca gerado por op de motor.
    let bad = parse_request(r#"{"v":2,"op":"main","args":{}}"#);
    assert!(bad.is_err(), "v inválido é erro de protocolo (exit 2)");
    let _ = std::fs::remove_dir_all(&target);
    let _ = std::fs::remove_dir_all(&clean);
}

#[test]
fn cli_help_emits_nine_frozen_lines_and_missing_target_is_bad_target() {
    let r = req("runCli", json!({"argv": ["--help"]}), json!({}));
    let out = harness_installer::dispatcher::dispatch(&r).unwrap();
    let res = out.result.unwrap();
    assert_eq!(res["usage"].as_array().unwrap().len(), 9);
    assert_eq!(res["exitCode"], 0);

    let r = req("runCli", json!({"argv": []}), json!({}));
    let out = harness_installer::dispatcher::dispatch(&r).unwrap();
    assert_eq!(out.error.unwrap().code, "BAD_TARGET", "sem --target ⇒ exit 1");
}
