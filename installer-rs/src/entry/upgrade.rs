// Ordem CONGELADA do `runUpgrade` (install.mjs:2933-3014 @ c63e333):
// preflight → manifesto → parse → schema → runDoctor (SOMENTE LEITURA;
// report.verdict NÃO é gate) → collectAnswers → collectIncoming/generateConfig
// → planUpgrade/printPlan → [dry-run: retorno 0 writes] → confirmByLayer →
// backup+requireVerifiedBackup → applyUpgrade → buildManifest/writeManifest →
// runChecks → regrava manifesto → exitCode. PLANEA ANTES DE BACKUP.
// NÃO unificar com `main` (ADR-003 §2.2 / EX-BE-05 / BF-02b).
use crate::contract::Request;
use crate::entry::support as s;
use crate::error::EngineError;
use serde_json::{json, Value};

fn bad(code: &str, what: impl Into<String>, why: impl Into<String>, fix: impl Into<String>) -> EngineError {
    EngineError::new(code, what, why, fix)
}

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target_raw = s::str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    let dry_run = s::bool_arg(req, "dryRun");
    let source_dir = s::str_arg(req, "sourceDir");
    let answers_in = s::answers_of(req);

    // 1) preflight({ skipManifestGuard:true })
    let pf = crate::ops::preflight::run(&s::req("preflight", json!({
        "target": target_raw,
        "allowRoot": s::bool_arg(req, "allowRoot"),
        "nodeVersion": s::str_arg(req, "nodeVersion").unwrap_or("20.0.0"),
        "skipManifestGuard": true,
    }), &answers_in, target_raw))?;
    let target = pf["target"].as_str().unwrap_or(target_raw).to_string();

    // 2) manifesto presente
    let manifest_path = std::path::Path::new(&target).join(crate::ops::registry::MANIFEST_NAME);
    if !manifest_path.exists() {
        return Err(bad("NOT_INSTALLED", "upgrade requires prior installation (.harness-install.json missing); run init first", "manifesto ausente", "rode init antes de upgrade"));
    }
    // 3) parse
    let raw = std::fs::read_to_string(&manifest_path).map_err(|_| {
        bad("MANIFEST_INVALID", format!("manifesto ilegivel: {}", manifest_path.display()), "JSON ilegível", "corrija o manifesto")
    })?;
    let prev: Value = serde_json::from_str(&raw).map_err(|_| {
        bad("MANIFEST_INVALID", format!("manifesto ilegivel: {}", manifest_path.display()), "JSON ilegível", "corrija o manifesto")
    })?;
    // 4) schema v1 + source conhecido
    if prev["manifestSchemaVersion"] != 1 || prev.get("source").and_then(|v| v.as_str()).is_none() {
        return Err(bad("FOREIGN_MANIFEST", "manifesto estrangeiro: nao e do harness-installer", "schema/source inválidos", "rode init no destino"));
    }

    // 5) runDoctor — somente leitura. `report.verdict`/`doctorPre` NÃO é gate.
    let report = crate::ops::doctor::analyze(
        &target, source_dir, s::str_arg(req, "answersFile"),
        s::str_arg(req, "backupDir").or(s::str_arg(req, "backupRoot")),
        s::bool_arg(req, "allowRoot"),
    )?;
    let doctor_pre = json!({"verdict": report["verdict"], "next": report["report"]["next"]});

    // 6) collectAnswers
    let mut effective = prev.get("answers").cloned().unwrap_or_else(|| json!({}));
    if let Some(obj) = effective.as_object_mut() {
        for (k, v) in answers_in.as_object().unwrap_or(&serde_json::Map::new()) {
            obj.insert(k.clone(), v.clone());
        }
    }
    let answers = crate::ops::answers::collect(&s::req("collectAnswers", json!({
        "target": target, "scripted": effective,
    }), &effective, &target))?;

    // 7) collectIncoming → generateConfig
    let incoming = s::collect_incoming(req, source_dir, &s::profile_stack(&answers, req))?;
    let generated = s::generate_config(&answers, &incoming)?;
    let mut files = incoming.as_object().cloned().unwrap_or_default();
    files.insert("harness.config.json".into(), Value::String(generated));

    // 8) planUpgrade → printPlan (aqui: plano em memória)
    let plan = crate::ops::merge::plan_upgrade(&target, &files, &prev)?;

    // 9) dry-run: retorno antecipado, 0 writes, sem backup/confirm/checks
    if dry_run {
        return Ok(s::dry_result(&target, &answers, &plan));
    }

    // 10) confirmByLayer (scriptado: --yes ou args.confirm)
    if !s::bool_arg(req, "yes") && !s::bool_arg(req, "confirm") {
        // scripted: sem TTY, assume confirmação via args (o oráculo usaria stdin).
        // USER_ABORT explícito é propagado como erro, 0 writes.
        if s::bool_arg(req, "abort") {
            return Err(bad("USER_ABORT", "cancelado pelo usuario no upgrade", "aborto", "rerode com --yes"));
        }
    }

    // 11) backup + requireVerifiedBackup — DEPOIS de planejar
    let bk = crate::ops::backup::backup(&target, s::str_arg(req, "backupDir").or(s::str_arg(req, "backupRoot")), s::bool_arg(req, "injectFailure"))?;
    crate::ops::backup::require_verified_backup(&bk)?;

    // 12) applyUpgrade — flag vira collisions e CONTINUA (não aborta)
    let result = crate::ops::merge::apply_upgrade(&target, &plan, &files, false)?;
    let written = result["written"].as_array().cloned().unwrap_or_default();
    let installed: Vec<Value> = written.iter().filter(|w| matches!(w["strategy"].as_str(), Some("create") | Some("generate-overwrite") | Some("overwrite")))
        .map(|w| json!({"path": w["path"], "kind": "file", "preMergeSha256": w["preMergeSha256"]})).collect();
    let merged: Vec<Value> = written.iter().filter(|w| w["strategy"] == "merge")
        .map(|w| json!({"path": w["path"], "kind": "file", "preMergeSha256": w["preMergeSha256"]})).collect();
    let flagged = result["flagged"].as_array().cloned().unwrap_or_default();
    let mut file_contents = serde_json::Map::new();
    for w in &written {
        if let Some(p) = w["path"].as_str() {
            if let Ok(text) = std::fs::read_to_string(std::path::Path::new(&target).join(p)) {
                file_contents.insert(p.to_string(), Value::String(text));
            }
        }
    }

    // 13) buildManifest → writeManifest → runChecks → regrava manifesto
    let mut manifest = crate::ops::manifest::build_manifest(&json!({
        "target": target,
        "backupDir": bk["backupDir"],
        "installed": installed,
        "merged": merged,
        "flagged": flagged,
        "answers": answers,
        "checks": {"passed": true, "failed": []},
        "fileContents": Value::Object(file_contents),
        "source": "harness@0.1.0",
    }));
    manifest["upgradedFrom"] = prev.get("source").cloned().unwrap_or(Value::Null);
    manifest["removed"] = result["removed"].clone();
    manifest["collisions"] = json!(flagged.iter().map(|f| f["path"].clone()).collect::<Vec<_>>());
    manifest["doctorPre"] = doctor_pre;
    let manifest_ref = crate::ops::write::write_manifest(&target, &manifest, false);
    let checks = crate::ops::checks::run_checks(&target, Some(&manifest));
    manifest["checks"] = checks.clone();
    let _ = crate::ops::write::write_manifest(&target, &manifest, false);

    // 14) exitCode
    let exit_code = if checks["passed"] == false { 1 } else { 0 };
    Ok(json!({
        "target": target,
        "answers": crate::ops::manifest::serialize_answers(&answers),
        "plan": plan,
        "applied": true,
        "result": result,
        "checks": checks,
        "manifestRef": manifest_ref,
        "manifest": manifest,
        "removed": result["removed"],
        "collisions": manifest["collisions"],
        "backupDir": bk["backupDir"],
        "exitCode": exit_code,
    }))
}
