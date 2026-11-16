// Dispatcher de 31 `op`s: 23 D-ENGINE (ADR-003 §2.1) + 8 D-TUI (ADR-004,
// ADR-001 §5). Fonte real dos nomes: TABELA ADR-003 §2.1 (linhas 59-83) e
// a lista D-TUI de installer/contract-inventory.mjs:24 — ambas espelhadas em
// tests/contract_spec.rs e tests/tui_ops_spec.rs. Nenhuma op de TUI grava.
// A macro abaixo é a ÚNICA fonte do vetor de nomes e dos braços de despacho:
// cada entrada nomeada abaixo é um braço executável do despacho, não comentário.
use crate::contract::{error_envelope, success_envelope, Envelope, ErrorBody, ProtocolError, Request};
use crate::error::EngineError;
use serde_json::Value;

fn body(e: EngineError) -> ErrorBody {
    ErrorBody {
        code: e.code,
        what: e.what,
        why: e.why,
        fix: e.fix,
        where_: e.where_,
    }
}

macro_rules! engine_ops {
    ($(case $name:literal => $handler:path),+ $(,)?) => {
        pub const OP_NAMES: [&str; 31] = [$($name),+];

        pub fn dispatch(req: &Request) -> Result<Envelope, ProtocolError> {
            if !OP_NAMES.contains(&req.op.as_str()) {
                return Err(ProtocolError::UnknownOp(req.op.clone()));
            }
            let outcome: Result<Value, EngineError> = match req.op.as_str() {
                $($name => $handler(req),)+
                _ => unreachable!("op validada por OP_NAMES"),
            };
            Ok(match outcome {
                Ok(result) => success_envelope(&req.op, result),
                Err(e) => error_envelope(&req.op, body(e)),
            })
        }
    };
}

engine_ops! {
    case "applyMerge" => crate::ops::merge::run_apply,
    case "backup" => crate::ops::backup::run,
    case "buildManifest" => crate::ops::manifest::run,
    case "collectAnswers" => crate::ops::answers::collect,
    case "collectIncoming" => crate::ops::incoming::collect,
    case "generateConfig" => crate::ops::config::generate,
    case "inventory" => crate::ops::inventory::run,
    case "loadAnswersFile" => crate::ops::answers::load,
    case "main" => crate::entry::main::run,
    case "mergeAgentFile" => crate::ops::agent_file::run,
    case "mergeOpencodeJson" => crate::ops::opencode::run,
    case "parseArgs" => crate::ops::args::run,
    case "planMerge" => crate::ops::merge::run_plan,
    case "preflight" => crate::ops::preflight::run,
    case "requireVerifiedBackup" => crate::ops::backup::run_require,
    case "resolveBackupDir" => crate::ops::backup_dir::run,
    case "runChecks" => crate::ops::checks::run,
    case "runCli" => crate::entry::cli::run,
    case "runDoctor" => crate::ops::doctor::run,
    case "runInit" => crate::entry::init::run,
    case "runUpgrade" => crate::entry::upgrade::run,
    case "runWizard" => crate::entry::wizard::run,
    case "writeManifest" => crate::ops::write::run,
    case "askMenuStep" => crate::tui::ops::ask_menu_step,
    case "detect" => crate::tui::ops::detect,
    case "printPlan" => crate::tui::ops::print_plan,
    case "printUsage" => crate::tui::ops::print_usage,
    case "promptAnswers" => crate::tui::ops::prompt_answers,
    case "readSecretPrompt" => crate::tui::ops::read_secret_prompt,
    case "readSecretRaw" => crate::tui::ops::read_secret_raw,
    case "sourceLineOf" => crate::tui::ops::source_line_of,
}
