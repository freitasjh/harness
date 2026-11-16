//! Segredo sem eco e `serializeSkips` em pipe (ADR-004 §2.4, RF-07/08/18).
//!
//! TTY: `canNoEcho` ⇒ desativa eco via cleanup (RAII) → leitura → restaura;
//! `q` no segredo é `USER_ABORT` (REQ-11/INS-16); token vazio é válido.
//! Pipe: nenhuma chave `deployToken` no envelope; `sanitizeLog` redige toda
//! linha. Nenhum prompt/default/range/mensagem novo; `\r` e espaço final
//! preservados (parecer UX "gotchas byte-level").

use crate::ops::manifest::serialize_answers;
use crate::ops::registry::QUESTIONS;
use crate::tui::cleanup;
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenValor<'a> {
    Abortado,
    Valido(&'a str),
}

pub fn chave_secreta() -> &'static str {
    QUESTIONS.iter().find(|q| q.secret).map(|q| q.key).unwrap_or("deployToken")
}

/// Espelha `canNoEcho(input)` do oráculo: TTY real com suporte a raw mode.
pub fn can_no_echo(tty: bool, raw_mode: bool) -> bool {
    tty && raw_mode
}

/// Prompt do segredo — literal congelado (transcript `:38`). Termina em espaço.
pub fn prompt_de_segredo() -> &'static str {
    "[5/5] Token de deploy (sensivel, opcional)? (q cancela) "
}

/// Literal congelado `install.mjs:2365` @ c63e333.
pub fn linha_redacted() -> String {
    format!("  [OK] {} = [REDACTED]", chave_secreta())
}

/// `ABORT_TOKENS` do oráculo (`install.mjs:2019`) — nenhum token novo.
pub fn is_abort_token(s: &str) -> bool {
    matches!(s.trim(), "q" | "quit" | "cancel" | "cancelar" | "abort" | "abortar")
}

/// `q` no segredo ⇒ `USER_ABORT`; vazio permitido; valor cru preservado.
pub fn validar_token(s: &str) -> TokenValor<'_> {
    if is_abort_token(s) { TokenValor::Abortado } else { TokenValor::Valido(s) }
}

/// Remove somente escapes ANSI (`stripAnsi` do oráculo) — `\r` intacto.
fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '\u{1b}' {
            out.push(c);
            continue;
        }
        if chars.peek() == Some(&'[') {
            chars.next();
            for seq in chars.by_ref() {
                if seq.is_ascii_alphabetic() || seq == '@' || seq == '~' {
                    break;
                }
            }
        }
    }
    out
}

/// Redação idempotente de toda linha antes do sink (`sanitizeLog`).
pub fn sanitize_log(line: &str, secret: &str) -> String {
    let limpo = strip_ansi(line);
    if secret.is_empty() {
        limpo
    } else {
        limpo.replace(secret, "[REDACTED]")
    }
}

/// Envelope de `promptAnswers` em pipe: `serializeSkips=true` garante ausência
/// da chave secreta. `serialize_answers` já omite todo campo `secret`.
pub fn serialize_skips(answers: &Value, serialize_skips: bool) -> Value {
    let mut out = serialize_answers(answers);
    if serialize_skips {
        if let Some(obj) = out.as_object_mut() {
            obj.remove(chave_secreta());
        }
    }
    out
}

/// Leitura sem eco em TTY. Handler de cleanup registrado ANTES de desativar
/// o eco; `Guard` restaura em EOF/erro por RAII e o handler cobre sinais.
pub fn read_secret_no_echo() -> String {
    let _guard = cleanup::register_cleanup();
    cleanup::desativar_echo();
    let mut buf = String::new();
    let _ = std::io::stdin().read_line(&mut buf);
    buf.trim_end_matches(['\r', '\n']).to_string()
}
