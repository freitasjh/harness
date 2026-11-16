//! Navegação congelada da TUI (ADR-004 §2.2, RF-03/12/18).
//!
//! Ordem exata de `runWizard`: W0→W1→W2→{W2m-1→W2m-2 | ∅}→W3→W4→… .
//! Exatamente 4 ramos medidos no oráculo `c63e333`; nenhum quinto ramo,
//! nenhum rótulo `voltar`/`pular`. `report.verdict` é dado, nunca gate:
//! `proxima_ignorando_verdict` existe para provar essa invariável.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ecra {
    W0,
    W1,
    W2,
    W2m1,
    W2m2,
    W3,
    W4,
    W5,
    W6,
    W7,
    Fim,
    Aborto,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct Contexto {
    pub has_pubspec: bool,
    pub encadeia: bool,
    pub aborto: bool,
    pub dry_run: bool,
    pub invalido: bool,
}

/// Ordem canônica (sem pubspec, item com `next`) até W4 — ADR-004 §2.2.
pub fn ordem_congelada() -> [&'static str; 7] {
    ["W0", "W1", "W2", "W2m-1", "W2m-2", "W3", "W4"]
}

/// Próxima tela. Retry devolve a MESMA tela: é a pergunta reemitida com
/// `formatError`, não uma transição nova.
pub fn proxima(atual: Ecra, ctx: &Contexto) -> Ecra {
    if ctx.aborto {
        return Ecra::Aborto;
    }
    match atual {
        Ecra::W0 => Ecra::W1,
        Ecra::W1 => Ecra::W2,
        Ecra::W2 => {
            if ctx.has_pubspec { Ecra::W3 } else { Ecra::W2m1 }
        }
        Ecra::W2m1 => {
            if ctx.invalido { Ecra::W2m1 } else if ctx.encadeia { Ecra::W2m2 } else { Ecra::W3 }
        }
        Ecra::W2m2 => {
            if ctx.invalido { Ecra::W2m2 } else { Ecra::W3 }
        }
        Ecra::W3 => {
            if ctx.invalido { Ecra::W3 } else { Ecra::W4 }
        }
        Ecra::W4 => Ecra::W5,
        Ecra::W5 => {
            if ctx.dry_run { Ecra::Fim } else { Ecra::W6 }
        }
        Ecra::W6 => Ecra::W7,
        Ecra::W7 | Ecra::Fim | Ecra::Aborto => atual,
    }
}

/// `report.verdict` é insumo informativo (ADR-003 §2.1 / ADR-004 §2.2):
/// nunca altera a transição.
pub fn proxima_ignorando_verdict(atual: Ecra, ctx: &Contexto, _report_verdict: &str) -> Ecra {
    proxima(atual, ctx)
}

/// Os 4 ramos medidos em `install.mjs:2295/2307/2343/2412-2424` @ c63e333.
pub fn ramos_medidos() -> [&'static str; 4] {
    [
        "W2: com pubspec -> W3 | sem pubspec -> W2m-1",
        "W2m-1: com next -> W2m-2 | sem next -> W3",
        "retry: mesma pergunta reemitida com formatError",
        "aborto: USER_ABORT/NO_STDIN (exit 1) | dry-run (exit 0, 0 writes)",
    ]
}

const TRANSICOES: [&str; 17] = [
    "W0->W1",
    "W1->W2",
    "W2->W3",
    "W2->W2m-1",
    "W2m-1->W2m-2",
    "W2m-1->W3",
    "W2m-1->W2m-1",
    "W2m-2->W3",
    "W2m-2->W2m-2",
    "W3->W4",
    "W3->W3",
    "W4->W5",
    "W5->W6",
    "W5->Fim",
    "W6->W7",
    "W7->Fim",
    "qualquer->Aborto",
];

/// Inventário completo de transições permitidas — a união dos 4 ramos
/// medidos com a linha reta do oráculo. Nenhuma transição adicional.
pub fn transicoes_permitidas() -> &'static [&'static str] {
    &TRANSICOES
}
