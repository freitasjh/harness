// HARN-BE-04 — teste ANTES da implementação (TDD).
// RF-07/RF-08 (ADR-003 §2.4.1): mensagem 4-linhas byte-equal ao oráculo,
// 22 códigos do Set de install.mjs:1529-1535 + UNKNOWN (achado S3),
// printUsage 9 linhas, --help ⇒ 0, sem --target ⇒ 1 (protocolo/parseArgs).
// Nenhum código/preset/chave/default novo: NOT_INSTALLED/MANIFEST_INVALID ⇒ UNKNOWN.
use harness_installer::error::{render_error_code, ERROR_CODES, UNKNOWN};
use harness_installer::ops::args::{parse_args, ParsedArgs};
use harness_installer::text::error::{format_error, ErrorParts};
use harness_installer::text::usage::usage_lines;
use serde_json::json;

fn parts(code: &str) -> ErrorParts<'_> {
    ErrorParts {
        what: "falha na instalacao",
        code,
        why: "",
        fix: "corrija",
        where_: "installer/install.mjs",
    }
}

#[test]
fn error_codes_are_exactly_22_measured_plus_unknown() {
    assert_eq!(ERROR_CODES.len(), 22, "Set medido em install.mjs:1529-1535 (S3)");
    assert_eq!(UNKNOWN, "UNKNOWN");
    // Número 23 do ADR é herança: nunca autoridade no motor.
    assert!(!ERROR_CODES.contains(&"NOT_INSTALLED"));
    assert!(!ERROR_CODES.contains(&"MANIFEST_INVALID"));
    assert_eq!(render_error_code("NOT_INSTALLED"), "UNKNOWN");
    assert_eq!(render_error_code("MANIFEST_INVALID"), "UNKNOWN");
}

#[test]
fn every_known_code_renders_the_frozen_four_lines() {
    for code in ERROR_CODES {
        let text = format_error(&parts(code), None);
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 4, "código {} deve produzir 4 linhas", code);
        assert_eq!(lines[0], "[ERRO] falha na instalacao");
        assert_eq!(lines[1], format!("  porquê: {}", code));
        assert_eq!(lines[2], "  como corrigir: corrija");
        assert_eq!(lines[3], "  onde ver: installer/install.mjs");
    }
}

#[test]
fn unknown_codes_collapse_to_unknown_without_new_vocabulary() {
    for code in ["NOT_INSTALLED", "MANIFEST_INVALID", "CODIGO_NOVO"] {
        let text = format_error(&parts(code), None);
        assert!(text.contains("  porquê: UNKNOWN\n"), "código {} virou UNKNOWN", code);
        assert!(!text.contains(code), "código {} não vaza como vocab novo", code);
    }
}

#[test]
fn format_error_strips_ansi_and_single_linefies_why() {
    let p = ErrorParts {
        what: "com\u{1b}[31mERRO\u{1b}[0m",
        code: "BAD_ANSWER",
        why: "linha um\n   linha dois",
        fix: "",
        where_: "",
    };
    let text = format_error(&p, None);
    assert_eq!(text.lines().count(), 4);
    assert_eq!(text.lines().next().unwrap(), "[ERRO] comERRO");
    assert_eq!(text.lines().nth(1).unwrap(), "  porquê: BAD_ANSWER: linha um linha dois");
    assert_eq!(text.lines().nth(2).unwrap(), "  como corrigir: revise o valor informado.");
    assert_eq!(text.lines().nth(3).unwrap(), "  onde ver: installer/install.mjs");
}

#[test]
fn format_error_redacts_secret_from_answers() {
    let p = ErrorParts {
        what: "token SEGREDO_BE04 vazou",
        code: "BAD_ANSWER",
        why: "",
        fix: "",
        where_: "",
    };
    let text = format_error(&p, Some(&json!({"deployToken": "SEGREDO_BE04"})));
    assert!(!text.contains("SEGREDO_BE04"));
    assert!(text.contains("[REDACTED]"));
}

#[test]
fn print_usage_is_exactly_nine_frozen_lines() {
    let lines = usage_lines();
    assert_eq!(lines.len(), 9);
    assert!(lines[0].starts_with("uso: node installer/install.mjs init   --target"));
    assert!(lines[1].starts_with("uso: node installer/install.mjs doctor   --target"));
    assert!(lines[2].starts_with("uso: node installer/install.mjs upgrade --target"));
    assert_eq!(lines[8], "  legado (sem init|doctor): node installer/install.mjs --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]");
}

#[test]
fn parse_args_help_and_flags_match_frozen_contract() {
    let help = parse_args(&["--help".into()]).unwrap();
    assert!(help.help);
    assert!(help.target.is_none());

    let full = parse_args(&[
        "upgrade".into(), "--target".into(), "/tmp/x".into(), "--dry-run".into(),
        "--yes".into(), "--allow-root".into(), "--backup-dir".into(), "/tmp/b".into(),
        "--answers-file".into(), "/tmp/a.json".into(),
    ])
    .unwrap();
    assert_eq!(full.command.as_deref(), Some("upgrade"));
    assert_eq!(full.target.as_deref(), Some("/tmp/x"));
    assert!(full.dry_run && full.yes && full.allow_root);
    assert_eq!(full.backup_dir.as_deref(), Some("/tmp/b"));
    assert_eq!(full.answers_file.as_deref(), Some("/tmp/a.json"));
}

#[test]
fn parse_args_without_target_is_valid_parse_but_run_cli_rejects() {
    // parseArgs sozinho não exige target (runCli é que lança BAD_TARGET ⇒ exit 1).
    let a: ParsedArgs = parse_args(&[]).unwrap();
    assert!(a.target.is_none());
    assert!(!a.help);
}

#[test]
fn parse_args_unknown_positional_is_bad_answer() {
    let err = parse_args(&["comando-alheio".into()]).unwrap_err();
    assert_eq!(err.code, "BAD_ANSWER");
    let extra = parse_args(&["init".into(), "doctor".into()]).unwrap_err();
    assert_eq!(extra.code, "BAD_ANSWER");
}
