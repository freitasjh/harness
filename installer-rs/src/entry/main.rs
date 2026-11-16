// Ordem CONGELADA do `main` (install.mjs:1606-1686 @ c63e333):
// preflight → inventory → [dry-run: sem backup] backup → requireVerifiedBackup
// → collectAnswers → generateConfig → planMerge → applyMerge → writeManifest
// → runChecks → regrava manifesto → exitCode. backup ANTES de planejar.
// NÃO unificar com runUpgrade (ADR-003 §2.2 / BF-02b).
use crate::contract::Request;
use crate::entry::support as s;
use crate::error::EngineError;
use serde_json::{json, Value};

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target = s::str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    let target = crate::ops::pathutil::resolve_path(target);
    let dry_run = s::bool_arg(req, "dryRun");
    let source_dir = s::str_arg(req, "sourceDir");
    let answers_in = s::answers_of(req);

    // 1) preflight
    let pf = crate::ops::preflight::run(&s::req("preflight", json!({
        "target": target,
        "allowRoot": s::bool_arg(req, "allowRoot"),
        "nodeVersion": s::str_arg(req, "nodeVersion").unwrap_or("20.0.0"),
        "skipManifestGuard": false,
    }), &answers_in, &target))?;
    let pf_target = pf["target"].as_str().unwrap_or(&target).to_string();

    // 2) inventory
    let inv = crate::ops::inventory::run(&s::req("inventory", json!({"target": pf_target}), &answers_in, &pf_target))?;

    // 3) backup (antes de planejar) + requireVerifiedBackup
    let bk = if dry_run {
        json!({"backupDir": Value::Null, "copied": [], "verified": true, "skipped": true})
    } else {
        crate::ops::backup::backup(&pf_target, s::str_arg(req, "backupDir").or(s::str_arg(req, "backupRoot")), s::bool_arg(req, "injectFailure"))?
    };
    crate::ops::backup::require_verified_backup(&bk)?;

    // 4) collectAnswers
    let answers = crate::ops::answers::collect(&s::req("collectAnswers", json!({
        "target": pf_target,
        "scripted": answers_in,
    }), &answers_in, &pf_target))?;

    // 5) generateConfig
    let incoming = s::collect_incoming(req, source_dir, &s::profile_stack(&answers, req))?;
    let generated = s::generate_config(&answers, &incoming)?;

    // 6) planMerge
    let mut files = incoming.as_object().cloned().unwrap_or_default();
    files.insert("harness.config.json".into(), Value::String(generated));
    let plan = crate::ops::merge::plan_merge(&pf_target, &files)?;

    if dry_run {
        return Ok(s::dry_result(&pf_target, &answers, &plan));
    }

    // 7) applyMerge — único ponto de escrita de conteúdo
    let result = crate::ops::merge::apply_merge(&pf_target, &plan, &files, false)?;
    let written = result["written"].as_array().cloned().unwrap_or_default();
    let installed: Vec<Value> = written.iter().filter(|w| matches!(w["strategy"].as_str(), Some("create") | Some("generate-overwrite")))
        .map(|w| json!({"path": w["path"], "kind": "file"})).collect();
    let merged: Vec<Value> = written.iter().filter(|w| w["strategy"] == "merge")
        .map(|w| json!({"path": w["path"], "strategy": "merge", "backupRef": bk["backupDir"], "preMergeSha256": w["preMergeSha256"]})).collect();
    let mut file_contents = serde_json::Map::new();
    for w in &written {
        if let Some(p) = w["path"].as_str() {
            if let Ok(text) = std::fs::read_to_string(std::path::Path::new(&pf_target).join(p)) {
                file_contents.insert(p.to_string(), Value::String(text));
            }
        }
    }

    // 8) buildManifest → writeManifest
    let manifest = crate::ops::manifest::build_manifest(&json!({
        "target": pf_target,
        "backupDir": bk["backupDir"],
        "installed": installed,
        "merged": merged,
        "flagged": result["flagged"],
        "answers": answers,
        "checks": {"passed": true, "failed": []},
        "fileContents": Value::Object(file_contents),
        "source": "harness@0.1.0",
    }));
    let manifest_ref = crate::ops::write::write_manifest(&pf_target, &manifest, false);

    // 9) runChecks DEPOIS do apply → regrava manifesto
    let checks = crate::ops::checks::run_checks(&pf_target, Some(&manifest));
    let mut final_manifest = manifest;
    final_manifest["checks"] = checks.clone();
    let _ = crate::ops::write::write_manifest(&pf_target, &final_manifest, false);

    // 10) exitCode — nenhum 0 em silêncio (BF-03)
    let exit_code = if checks["passed"] == false { 1 } else { 0 };
    Ok(json!({
        "target": pf_target,
        "inventory": inv,
        "backup": bk,
        "answers": crate::ops::manifest::serialize_answers(&answers),
        "profile": answers["stack"],
        "plan": plan,
        "result": result,
        "manifest": final_manifest,
        "manifestRef": manifest_ref,
        "checks": checks,
        "dryRun": false,
        "exitCode": exit_code,
    }))
}
