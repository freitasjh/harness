// runCli (install.mjs:2597-2735 @ c63e333). parseArgs → help (0) →
// despacho init|doctor|upgrade|legado. exitCode: 0 válido/dry-run,
// 1 reprovado, 2 SOMENTE protocolo contract-v1 (main.rs da crate).
use crate::contract::Request;
use crate::entry::support as s;
use crate::error::EngineError;
use serde_json::{json, Value};

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let parsed = crate::ops::args::from_request(req)?;

    if parsed.help {
        let usage = crate::text::usage::usage_lines();
        return Ok(json!({"help": true, "usage": usage, "exitCode": 0}));
    }

    let Some(target) = parsed.target.as_deref() else {
        return Err(EngineError::new("BAD_TARGET", "missing --target", "--target obrigatório", "informe --target"));
    };

    let mut args = serde_json::Map::new();
    args.insert("target".into(), Value::String(target.into()));
    args.insert("allowRoot".into(), json!(parsed.allow_root));
    args.insert("dryRun".into(), json!(parsed.dry_run));
    args.insert("yes".into(), json!(parsed.yes));
    if let Some(v) = &parsed.answers_file { args.insert("answersFile".into(), Value::String(v.clone())); }
    if let Some(v) = &parsed.backup_dir { args.insert("backupDir".into(), Value::String(v.clone())); }
    let sub = s::req("sub", Value::Object(args), &req.answers, target);

    match parsed.command.as_deref() {
        Some("doctor") => {
            let rep = crate::ops::doctor::analyze(target, s::str_arg(req, "sourceDir"), parsed.answers_file.as_deref(), parsed.backup_dir.as_deref(), parsed.allow_root)?;
            Ok(json!({"verdict": rep["verdict"], "report": rep["report"], "exitCode": rep["exitCode"]}))
        }
        Some("init") => crate::entry::init::run(&sub),
        Some("upgrade") => crate::entry::upgrade::run(&sub),
        _ => crate::entry::main::run(&sub),
    }
}
