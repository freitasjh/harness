// TUI-06 — teste ANTES da implementação (ADR-004 §2.3, RF-04/11/12).
// As 8 ops de TUI entram no dispatcher 1:1 com D-TUI (ADR-001 §5). O vetor
// final tem 31 nomes = 23 D-ENGINE + 8 D-TUI; nenhuma op de escrita na classe.
use harness_installer::contract::{parse_request, success_envelope};
use harness_installer::dispatcher::{dispatch, OP_NAMES};

const ENGINE: [&str; 23] = [
    "applyMerge", "backup", "buildManifest", "collectAnswers", "collectIncoming",
    "generateConfig", "inventory", "loadAnswersFile", "main", "mergeAgentFile",
    "mergeOpencodeJson", "parseArgs", "planMerge", "preflight", "requireVerifiedBackup",
    "resolveBackupDir", "runChecks", "runCli", "runDoctor", "runInit", "runUpgrade",
    "runWizard", "writeManifest",
];
const TUI_FROM_ADR001: [&str; 8] = [
    "askMenuStep", "detect", "printPlan", "printUsage", "promptAnswers",
    "readSecretPrompt", "readSecretRaw", "sourceLineOf",
];
const ESCRITA: [&str; 4] = ["applyMerge", "applyUpgrade", "writeManifest", "backup"];

fn req_args(op: &str, args: serde_json::Value) -> harness_installer::contract::Request {
    parse_request(&format!(
        r#"{{"v":1,"op":"{}","args":{},"answers":{{}},"target":null}}"#,
        op, args
    ))
    .expect("request válido")
}

fn req(op: &str) -> harness_installer::contract::Request {
    req_args(op, serde_json::json!({}))
}

#[test]
fn dispatcher_tem_31_ops_e_as_8_tui_1a1_com_adr001() {
    assert_eq!(OP_NAMES.len(), 31, "23 engine + 8 TUI");
    assert_eq!(&OP_NAMES[..23], &ENGINE, "ordem dos D-ENGINE congelada");
    assert_eq!(&OP_NAMES[23..], &TUI_FROM_ADR001, "8 D-TUI na ordem do inventário");
    let mut sorted = OP_NAMES.to_vec();
    sorted.sort_unstable();
    assert_eq!(sorted.len(), 31, "nenhum nome duplicado");
}

#[test]
fn nenhuma_op_de_escrita_esta_na_classe_tui() {
    for nome in ESCRITA {
        assert!(!TUI_FROM_ADR001.contains(&nome), "{} não é TUI", nome);
    }
    // As 8 TUI são leitura/formatação/interpelação: nenhuma chama de escrita.
    let fonte = include_str!("../src/tui/ops.rs");
    for padrao in ["std::fs::write", "fs::write", "File::create", "write_all", "OpenOptions"] {
        assert!(!fonte.contains(padrao), "TUI não grava: {}", padrao);
    }
}

#[test]
fn dispatch_de_cada_uma_das_8_tui_devolve_envelope_ok() {
    for op in TUI_FROM_ADR001 {
        let scripted = serde_json::json!({
            "target": "/tmp", "stack": "node", "project": "demo",
            "suiteCommand": "node", "pluginsDir": ".",
        });
        let args = match op {
            "promptAnswers" => serde_json::json!({ "target": "/tmp", "scripted": scripted }),
            "readSecretRaw" => serde_json::json!({ "tty": true, "rawMode": true, "input": "tk" }),
            "readSecretPrompt" => serde_json::json!({ "tty": true, "rawMode": true }),
            "sourceLineOf" => serde_json::json!({
                "marker": "runWizard", "path": format!("{}/installer/install.mjs", env!("CARGO_MANIFEST_DIR"))
            }),
            _ => serde_json::json!({}),
        };
        let env = dispatch(&req_args(op, args)).unwrap_or_else(|e| panic!("{} falhou no despacho: {}", op, e));
        let json = harness_installer::contract::envelope_json(&env);
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["v"], 1, "{} envelope v:1", op);
        assert_eq!(value["ok"], true, "{} sem erro", op);
        assert_eq!(value["op"], op, "{} op do envelope", op);
        assert!(value.get("result").is_some(), "{} tem result", op);
    }
    let _ = success_envelope("askMenuStep", serde_json::json!({}));
}

#[test]
fn op_tui_desconhecida_continua_sendo_erro_de_protocolo() {
    assert!(dispatch(&req("askMenuStepNaoExiste")).is_err());
}
