// HARN-BE-01 — teste ANTES da implementação (TDD).
// Fronteira contract-v1 (ADR-001 §2.1): envelope v:1, exit 0/1/2, segredo em stdin.
// Inventário de 23 nomes: D-ENGINE em installer/contract-inventory.mjs:18-23 @ c63e333
// (mesmo conjunto de ADR-001 §5 e ADR-003 §2.1). Nenhum nome é inventado aqui.
use harness_installer::contract::{
    envelope_json, error_envelope, exit_code, parse_request, success_envelope, ErrorBody,
};
use harness_installer::dispatcher::{dispatch, OP_NAMES};

const ENGINE_FROM_ORACLE: [&str; 23] = [
    "applyMerge", "backup", "buildManifest", "collectAnswers", "collectIncoming",
    "generateConfig", "inventory", "loadAnswersFile", "main", "mergeAgentFile",
    "mergeOpencodeJson", "parseArgs", "planMerge", "preflight", "requireVerifiedBackup",
    "resolveBackupDir", "runChecks", "runCli", "runDoctor", "runInit", "runUpgrade",
    "runWizard", "writeManifest",
];

fn req(op: &str) -> String {
    format!(
        r#"{{"v":1,"op":"{}","args":{{}},"answers":{{}},"target":null}}"#,
        op
    )
}

#[test]
fn parse_request_ok_exposes_v_op_args_answers() {
    let r = parse_request(&req("preflight")).expect("request válido");
    assert_eq!(r.v, 1);
    assert_eq!(r.op, "preflight");
    assert!(r.args.is_object());
    assert!(r.answers.is_object());
    assert!(r.target.is_none());
}

#[test]
fn parse_request_bad_json_is_protocol_error() {
    assert!(parse_request("no json").is_err());
    assert!(parse_request("").is_err());
}

#[test]
fn parse_request_bad_version_is_protocol_error() {
    let bad = r#"{"v":2,"op":"preflight","args":{},"answers":{}}"#;
    assert!(parse_request(bad).is_err());
}

#[test]
fn parse_request_missing_op_is_protocol_error() {
    let bad = r#"{"v":1,"args":{},"answers":{}}"#;
    assert!(parse_request(bad).is_err());
}

#[test]
fn envelope_success_has_v_op_result_and_no_error() {
    let env = success_envelope("preflight", serde_json::json!({ "target": "/tmp/x" }));
    let value: serde_json::Value = serde_json::from_str(&envelope_json(&env)).unwrap();
    assert_eq!(value["v"], 1);
    assert_eq!(value["ok"], true);
    assert_eq!(value["op"], "preflight");
    assert!(value.get("result").is_some());
    assert!(value.get("error").is_none());
    assert_eq!(exit_code(&env), 0);
}

#[test]
fn envelope_error_has_five_fields_and_no_result() {
    let env = error_envelope(
        "preflight",
        ErrorBody {
            code: "BAD_TARGET".into(),
            what: "missing --target".into(),
            why: "alvo ausente".into(),
            fix: "informe --target".into(),
            where_: "installer/install.mjs".into(),
        },
    );
    let value: serde_json::Value = serde_json::from_str(&envelope_json(&env)).unwrap();
    assert_eq!(value["v"], 1);
    assert_eq!(value["ok"], false);
    assert_eq!(value["op"], "preflight");
    assert!(value.get("result").is_none());
    assert_eq!(value["error"]["code"], "BAD_TARGET");
    for k in ["code", "what", "why", "fix", "where"] {
        assert!(value["error"].get(k).is_some(), "campo error.{} ausente", k);
    }
    assert_eq!(exit_code(&env), 1);
}

#[test]
fn dispatcher_has_exactly_the_23_engine_names() {
    assert_eq!(OP_NAMES.len(), 23);
    assert_eq!(OP_NAMES.as_slice(), &ENGINE_FROM_ORACLE);
    let mut sorted = OP_NAMES.to_vec();
    sorted.sort_unstable();
    assert_eq!(sorted.len(), 23, "nenhum nome duplicado");
}

#[test]
fn dispatcher_excludes_internal_and_tui_names() {
    for internal in ["planUpgrade", "applyUpgrade"] {
        assert!(!OP_NAMES.contains(&internal), "{} é interno (ADR-001 §5)", internal);
    }
    for tui in ["printUsage", "promptAnswers", "askMenuStep"] {
        assert!(!OP_NAMES.contains(&tui), "{} é TUI (ADR-004)", tui);
    }
}

#[test]
fn unknown_op_is_protocol_error_exit_2() {
    let r = parse_request(&req("opInventada")).unwrap();
    assert!(dispatch(&r).is_err(), "op fora do vocabulário ⇒ erro de protocolo");
}

#[test]
fn secret_in_stdin_is_never_echoed_by_binary() {
    use std::io::Write;
    use std::process::{Command, Stdio};
    let mut child = Command::new(env!("CARGO_BIN_EXE_harness-installer"))
        .arg("contract-v1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("binário disponível no cargo test");
    child
        .stdin
        .as_mut()
        .unwrap()
        .write_all(br#"{"v":1,"op":"preflight","args":{"target":"/tmp/harness-be01","uid":1000,"nodeVersion":"20.0.0","skipManifestGuard":true},"answers":{"deployToken":"SEGREDO_BE01"},"target":"/tmp/harness-be01"}"#)
        .unwrap();
    let out = child.wait_with_output().unwrap();
    let stdout = String::from_utf8_lossy(&out.stdout);
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(!stdout.contains("SEGREDO_BE01"), "segredo vazou em stdout");
    assert!(!stderr.contains("SEGREDO_BE01"), "segredo vazou em stderr");
    assert!(!out.stdout.is_empty(), "envelope ausente");
    let envelope: serde_json::Value = serde_json::from_str(stdout.trim()).expect("stdout é envelope JSON");
    assert_eq!(envelope["v"], 1);
    assert_eq!(envelope["op"], "preflight");
}
