//! W5 — confirmação por camada, aborto e dry-run (ADR-004 §2.3/§2.2,
//! RF-03/06/18). Tela decide; escrita permanece no motor. `flagged-open`
//! aborta antes do `apply`; `flag` no upgrade vira `collisions` e CONTINUA.

use serde_json::{json, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Confirmacao {
    Confirmado,
    Abortado,
    DryRun,
    MissingIncoming,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrilhaUpgrade {
    Segue,
    Colisoes,
}

/// Decisão pura de W5. Ordem dos gates preserva o oráculo: aborto/flagged
/// primeiro (0 writes), depois falta de incoming, depois dry-run.
pub fn decidir(
    yes: bool,
    dry_run: bool,
    aborto: bool,
    flagged_open: bool,
    missing_incoming: bool,
) -> Confirmacao {
    if aborto || flagged_open {
        Confirmacao::Abortado
    } else if missing_incoming {
        Confirmacao::MissingIncoming
    } else if dry_run {
        Confirmacao::DryRun
    } else {
        let _ = yes;
        Confirmacao::Confirmado
    }
}

/// `--yes` e dry-run dispensam a interação por camada (M6).
pub fn precisa_confirmar(yes: bool, dry_run: bool) -> bool {
    !yes && !dry_run
}

/// Envelope de aborto alinhado ao `error_envelope` real de `contract.rs`
/// (FU-ADR004-01): v/ok/op/error com 5 campos, SEM `exitCode` — o código de
/// saída é derivado por `exit_code()`. `why`/`where` são os de `wizard.rs::run`.
pub fn resultado_aborto() -> Value {
    json!({
        "v": 1,
        "ok": false,
        "op": "runWizard",
        "error": {
            "code": "USER_ABORT",
            "what": "cancelado pelo usuario no wizard",
            "why": "aborto",
            "fix": "rerode para continuar",
            "where": "installer/install.mjs",
        },
    })
}

/// `flag` no upgrade não aborta: vira `collisions` no manifesto e a trilha
/// segue para W6/W7 (ADR-004 §3 item 4 / install.mjs:2996 @ c63e333).
pub fn trilha_upgrade(tem_flag: bool) -> TrilhaUpgrade {
    if tem_flag { TrilhaUpgrade::Colisoes } else { TrilhaUpgrade::Segue }
}
