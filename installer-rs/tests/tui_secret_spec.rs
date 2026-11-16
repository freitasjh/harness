// TUI-04 — teste ANTES da implementação (ADR-004 §2.4, RF-07/08/18 INS-16).
// TTY sem eco; q no segredo ⇒ USER_ABORT; [OK] deployToken = [REDACTED];
// pipe ⇒ serializeSkips (chave ausente do envelope); sanitizeLog; token vazio
// permitido; nenhum byte novo no transcript (espaço final preservado, \r intacto).
use harness_installer::tui::secret::{
    can_no_echo, chave_secreta, linha_redacted, prompt_de_segredo, sanitize_log, serialize_skips,
    validar_token, TokenValor,
};
use serde_json::json;

const SEGREDO: &str = "SEGREDO_PROVA";

#[test]
fn can_no_echo_exige_tty_e_raw_mode() {
    assert!(can_no_echo(true, true));
    assert!(!can_no_echo(true, false));
    assert!(!can_no_echo(false, true));
    assert!(!can_no_echo(false, false));
}

#[test]
fn segredo_nunca_em_claro_em_log_ou_envelope() {
    assert_eq!(chave_secreta(), "deployToken");
    assert_eq!(sanitize_log(&format!("token={}", SEGREDO), SEGREDO), "token=[REDACTED]");
    assert!(!sanitize_log(&format!("token={}", SEGREDO), SEGREDO).contains(SEGREDO));
    let envelope = serialize_skips(&json!({"deployToken": SEGREDO, "project": "demo"}), true);
    assert_eq!(envelope.get("deployToken"), None, "chave deployToken AUSENTE no envelope de pipe");
    assert_eq!(envelope["project"], "demo");
    assert!(linha_redacted().contains("[OK] deployToken = [REDACTED]"));
}

#[test]
fn q_no_segredo_e_aborto_token_vazio_e_permitido() {
    assert_eq!(validar_token("q"), TokenValor::Abortado);
    assert_eq!(validar_token(""), TokenValor::Valido(""));
    assert_eq!(validar_token(SEGREDO), TokenValor::Valido(SEGREDO));
}

#[test]
fn gotchas_byte_level_do_parecer_ux() {
    assert!(prompt_de_segredo().ends_with(' '), "prompt termina em espaço (:38) — não trimar");
    assert_eq!(sanitize_log("linha\rcom retorno", SEGREDO), "linha\rcom retorno", "\\r não normalizar");
    assert_eq!(sanitize_log("\u{1b}[31mvermelho\u{1b}[0m", SEGREDO), "vermelho", "ANSI removido na sanitização (stripAnsi=AB)");
    assert!(!prompt_de_segredo().contains('\u{1b}'), "prompt sem escape ANSI");
}
