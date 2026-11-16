// Dispatcher de 23 `op`s de engine (ADR-003 §2.1, ADR-001 §5 / D-ENGINE).
// Nomes idênticos aos exports D-ENGINE em installer/contract-inventory.mjs:18-23 @ c63e333.
// A macro abaixo é a ÚNICA fonte do vetor de nomes e dos braços de despacho:
// cada entrada nomeada abaixo é um braço executável do despacho, não comentário.
use crate::contract::{error_envelope, success_envelope, Envelope, ErrorBody, ProtocolError, Request};
use crate::error::EngineError;
use serde_json::Value;

fn pending(req: &Request) -> Result<Value, EngineError> {
    Err(EngineError::new(
        "UNKNOWN",
        format!("op {} registrada, implementação pendente de batch posterior", req.op),
        "vocabulário fechado: nenhum código novo é inventado",
        "consulte o cronograma do ADR-003",
    ))
}

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
        pub const OP_NAMES: [&str; 23] = [$($name),+];

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
    case "applyMerge" => pending,
    case "backup" => pending,
    case "buildManifest" => pending,
    case "collectAnswers" => crate::ops::answers::collect,
    case "collectIncoming" => crate::ops::incoming::collect,
    case "generateConfig" => crate::ops::config::generate,
    case "inventory" => crate::ops::inventory::run,
    case "loadAnswersFile" => crate::ops::answers::load,
    case "main" => pending,
    case "mergeAgentFile" => pending,
    case "mergeOpencodeJson" => pending,
    case "parseArgs" => pending,
    case "planMerge" => pending,
    case "preflight" => crate::ops::preflight::run,
    case "requireVerifiedBackup" => pending,
    case "resolveBackupDir" => crate::ops::backup_dir::run,
    case "runChecks" => pending,
    case "runCli" => pending,
    case "runDoctor" => pending,
    case "runInit" => pending,
    case "runUpgrade" => pending,
    case "runWizard" => pending,
    case "writeManifest" => pending,
}
