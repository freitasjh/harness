// runInit (install.mjs:2481-2590 @ c63e333). CREATE-ONLY: destino sujo (merge
// ou flag) ⇒ `flagged-open`, exit 1, 0 writes, dica apontando doctor.
// `upgrade` com flag ⇒ collisions e CONTINUA (não aborta) — ver upgrade.rs.
use crate::contract::Request;
use crate::entry::support as s;
use crate::error::EngineError;
use serde_json::{json, Value};

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target_raw = s::str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    let target = crate::ops::pathutil::resolve_path(target_raw);
    let answers_in = s::answers_of(req);
    let dry_run = s::bool_arg(req, "dryRun");
    let source_dir = s::str_arg(req, "sourceDir");

    let pf = crate::ops::preflight::run(&s::req("preflight", json!({
        "target": target,
        "allowRoot": s::bool_arg(req, "allowRoot"),
        "nodeVersion": s::str_arg(req, "nodeVersion").unwrap_or("20.0.0"),
        "skipManifestGuard": false,
    }), &answers_in, &target))?;
    let t = pf["target"].as_str().unwrap_or(&target).to_string();

    let answers = crate::ops::answers::collect(&s::req("collectAnswers", json!({
        "target": t, "scripted": answers_in,
    }), &answers_in, &t))?;
    let incoming = s::collect_incoming(req, source_dir, &s::profile_stack(&answers, req))?;
    let generated = s::generate_config(&answers, &incoming)?;
    let mut files = incoming.as_object().cloned().unwrap_or_default();
    files.insert("harness.config.json".into(), Value::String(generated));
    let plan = crate::ops::merge::plan_merge(&t, &files)?;

    // Gate create-only ANTES de qualquer escrita (0 writes no aborto).
    if let Err(e) = crate::ops::merge::assert_create_only(&plan) {
        let mut enriched = e;
        enriched.fix = "rode doctor --target <dir> para diagnosticar (D0-D6), ou limpe o destino e rode init de novo.".into();
        enriched.where_ = "installer/install.mjs (runInit gate create-only; doctor D0-D6)".into();
        return Err(enriched);
    }

    if dry_run {
        return Ok(s::dry_result(&t, &answers, &plan));
    }

    // Caminho limpo: delega ao `main` (backup verificado antes do apply).
    let out = crate::entry::main::run(req)?;
    Ok(json!({
        "target": out["target"],
        "answers": crate::ops::manifest::serialize_answers(&answers),
        "plan": plan,
        "applied": true,
        "result": out["result"],
        "checks": out["checks"],
        "manifestRef": out["manifestRef"],
        "backupDir": out["backup"]["backupDir"],
        "exitCode": out["exitCode"],
    }))
}
