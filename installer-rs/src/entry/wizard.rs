// runWizard (install.mjs:2251-2470 @ c63e333). Orquestra W0..W7 sobre o
// caminho comum `main`. Tela é ADR-004 (fora de escopo); aqui só a herança de
// canais e o contrato de aborto/0 writes. USER_ABORT ⇒ exit 1.
use crate::contract::Request;
use crate::entry::support as s;
use crate::error::EngineError;
use crate::tui::model::{total_campos, TELAS};
use serde_json::{json, Value};

/// Catálogo declarativo das 10 telas × 5 campos (ADR-004 §2.1). Somente
/// leitura: a tela interpela/formata; `apply` permanece no motor (ADR-003).
pub fn declaracao_telas() -> (&'static [crate::tui::model::Tela], usize) {
    (&TELAS, total_campos())
}

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target_raw = s::str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    let target = crate::ops::pathutil::resolve_path(target_raw);
    let pf = crate::ops::preflight::run(&s::req("preflight", json!({
        "target": target,
        "allowRoot": s::bool_arg(req, "allowRoot"),
        "nodeVersion": s::str_arg(req, "nodeVersion").unwrap_or("20.0.0"),
        "skipManifestGuard": false,
    }), &req.answers, &target))?;
    let t = pf["target"].as_str().unwrap_or(&target).to_string();

    if s::bool_arg(req, "abort") || req.args.get("abortToken").and_then(|v| v.as_str()) == Some("q") {
        return Err(EngineError::new("USER_ABORT", "cancelado pelo usuario no wizard", "aborto", "rerode para continuar"));
    }
    if s::bool_arg(req, "noStdin") {
        return Err(EngineError::new("NO_STDIN", "stdin fechado (EOF) no wizard", "sem fonte de respostas", "rode interativo ou passe --answers-file"));
    }
    if s::bool_arg(req, "dryRun") {
        let plan: Vec<Value> = Vec::new();
        return Ok(s::dry_result(&t, &req.answers, &plan));
    }

    let out = crate::entry::main::run(req)?;
    Ok(json!({
        "target": t,
        "applied": true,
        "answers": crate::ops::manifest::serialize_answers(&req.answers),
        "plan": out["plan"],
        "result": out["result"],
        "checks": out["checks"],
        "exitCode": out["exitCode"],
    }))
}
