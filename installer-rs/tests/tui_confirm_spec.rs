// TUI-03 — teste ANTES da implementação (ADR-004 §2.3/§2.2, RF-03/06/18).
// W5: q/EOF/USER_ABORT ⇒ exit 1, 0 writes; flagged-open aborta; flag no upgrade
// vira collisions e continua; dry-run ⇒ applied:false, 0 writes, exit 0;
// --yes pula; MISSING_INCOMING encerra sem W6/W7.
use harness_installer::tui::confirm::{
    decidir, precisa_confirmar, resultado_aborto, trilha_upgrade, Confirmacao, TrilhaUpgrade,
};
use serde_json::json;

#[test]
fn confirmacao_padrao_e_sim() {
    let livre = ContextoConfirmacao::padrao();
    assert_eq!(decidir(livre.yes, livre.dry_run, livre.aborto, livre.flagged_open, livre.missing_incoming), Confirmacao::Confirmado);
    assert!(precisa_confirmar(false, false), "sem --yes: confirma por camada");
    assert!(!precisa_confirmar(true, false), "--yes pula confirmação");
    assert!(!precisa_confirmar(false, true), "dry-run não confirma");
}

#[test]
fn aborto_e_flagged_open_nao_gravam() {
    let aborto = decidir(false, false, true, false, false);
    assert_eq!(aborto, Confirmacao::Abortado);
    let flagged = decidir(true, false, false, true, false);
    assert_eq!(flagged, Confirmacao::Abortado, "flagged-open aborta mesmo com --yes");
    let env = resultado_aborto();
    // FU-ADR004-01: envelope de teste alinhado ao contract-v1 real
    // (contract.rs::error_envelope) — sem campo `exitCode`, 5 campos de erro.
    assert_eq!(env["v"], 1);
    assert_eq!(env["ok"], false);
    assert_eq!(env["op"], "runWizard");
    assert_eq!(env["error"]["code"], "USER_ABORT");
    for k in ["code", "what", "why", "fix", "where"] {
        assert!(env["error"].get(k).is_some(), "campo error.{} ausente", k);
    }
    assert!(env.get("exitCode").is_none(), "envelope real não tem exitCode");
    assert!(env.get("result").is_none(), "envelope de erro não tem result");
}

#[test]
fn dry_run_applied_false_e_checks_skipped() {
    let seco = decidir(false, true, false, false, false);
    assert_eq!(seco, Confirmacao::DryRun);
    let r = harness_installer::entry::support::dry_result("/tmp/alvo", &json!({}), &[]);
    assert_eq!(r["applied"], false);
    assert_eq!(r["backupDir"], serde_json::Value::Null);
    assert_eq!(r["checks"]["passed"], serde_json::Value::Null);
    assert_eq!(r["checks"]["ran"], false);
    assert_eq!(r["checks"]["skipped"], true);
    assert_eq!(r["exitCode"], 0);
}

#[test]
fn missing_incoming_encerra_sem_w6_w7() {
    assert_eq!(decidir(false, false, false, false, true), Confirmacao::MissingIncoming);
}

#[test]
fn upgrade_com_flag_vira_collisions_e_continua() {
    assert_eq!(trilha_upgrade(false), TrilhaUpgrade::Segue);
    assert_eq!(trilha_upgrade(true), TrilhaUpgrade::Colisoes);
    // Colisões NÃO abortam: a trilha segue para W6/W7 (apply continua).
    assert!(matches!(trilha_upgrade(true), TrilhaUpgrade::Colisoes));
}

struct ContextoConfirmacao {
    yes: bool,
    dry_run: bool,
    aborto: bool,
    flagged_open: bool,
    missing_incoming: bool,
}

impl ContextoConfirmacao {
    fn padrao() -> Self {
        Self { yes: false, dry_run: false, aborto: false, flagged_open: false, missing_incoming: false }
    }
}
