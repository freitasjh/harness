// parseArgs (install.mjs:1761-1783 @ c63e333). Sem crate de CLI para texto:
// a crate só valida; os textos de usage/erro são os congelados em text/.
use crate::error::EngineError;
use serde_json::{json, Value};

const CLI_COMMANDS: [&str; 3] = ["init", "doctor", "upgrade"];

#[derive(Debug, Clone, Default)]
pub struct ParsedArgs {
    pub command: Option<String>,
    pub target: Option<String>,
    pub allow_root: bool,
    pub dry_run: bool,
    pub answers_file: Option<String>,
    pub yes: bool,
    pub backup_dir: Option<String>,
    pub help: bool,
}

impl ParsedArgs {
    pub fn to_value(&self) -> Value {
        json!({
            "command": self.command,
            "target": self.target,
            "allowRoot": self.allow_root,
            "dryRun": self.dry_run,
            "answersFile": self.answers_file,
            "yes": self.yes,
            "backupDir": self.backup_dir,
            "help": self.help,
        })
    }
}

pub fn parse_args(argv: &[String]) -> Result<ParsedArgs, EngineError> {
    let mut out = ParsedArgs::default();
    let mut i = 0;
    while i < argv.len() {
        let a = &argv[i];
        match a.as_str() {
            "--target" => {
                i += 1;
                out.target = argv.get(i).cloned();
            }
            "--allow-root" => out.allow_root = true,
            "--dry-run" => out.dry_run = true,
            "--answers-file" => {
                i += 1;
                out.answers_file = argv.get(i).cloned();
            }
            "--yes" | "-y" => out.yes = true,
            "--backup-dir" => {
                i += 1;
                out.backup_dir = argv.get(i).cloned();
            }
            "--help" | "-h" => out.help = true,
            _ if a.starts_with('-') => {}
            _ if out.command.is_none() => {
                if !CLI_COMMANDS.contains(&a.as_str()) {
                    return Err(EngineError::new(
                        "BAD_ANSWER",
                        format!("comando desconhecido '{}' (use init|doctor|upgrade; sem comando segue o fluxo install legado)", a),
                        "posicional fora do vocabulário de entrypoints",
                        "use init|doctor|upgrade",
                    ));
                }
                out.command = Some(a.clone());
            }
            _ => {
                return Err(EngineError::new(
                    "BAD_ANSWER",
                    format!("posicional extra '{}' (um comando por invocacao: init|doctor|upgrade)", a),
                    "segundo posicional não é aceito",
                    "use um comando por invocação",
                ));
            }
        }
        i += 1;
    }
    Ok(out)
}

pub fn from_request(req: &crate::contract::Request) -> Result<ParsedArgs, EngineError> {
    let argv: Vec<String> = req
        .args
        .get("argv")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(str::to_string)).collect())
        .unwrap_or_default();
    parse_args(&argv)
}

pub fn run(req: &crate::contract::Request) -> Result<Value, EngineError> {
    Ok(from_request(req)?.to_value())
}
