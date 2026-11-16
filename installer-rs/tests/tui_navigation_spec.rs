// TUI-02 — teste ANTES da implementação (ADR-004 §2.2, RF-03/12/18).
// Ordem exata de runWizard, exatamente 4 ramos medidos, 0 transição nova;
// retry da MESMA pergunta com formatError; report.verdict nunca é gate.
use harness_installer::tui::navigation::{
    ordem_congelada, proxima, proxima_ignorando_verdict, ramos_medidos, transicoes_permitidas,
    Contexto, Ecra,
};

#[test]
fn ordem_exata_w0_ate_w4() {
    assert_eq!(
        ordem_congelada(),
        ["W0", "W1", "W2", "W2m-1", "W2m-2", "W3", "W4"],
        "ordem congelada de runWizard (ADR-004 §2.2)"
    );
    let ctx = Contexto { has_pubspec: false, encadeia: true, ..Contexto::default() };
    let mut ecra = Ecra::W0;
    let mut vistos = Vec::new();
    for _ in 0..7 {
        vistos.push(ecra);
        ecra = proxima(ecra, &ctx);
    }
    assert_eq!(vistos, vec![Ecra::W0, Ecra::W1, Ecra::W2, Ecra::W2m1, Ecra::W2m2, Ecra::W3, Ecra::W4]);
}

#[test]
fn quatro_ramos_medidos_nenhum_quinto() {
    let ramos = ramos_medidos();
    assert_eq!(ramos.len(), 4, "exatamente 4 ramos medidos — nenhum 5º");
    assert!(ramos[0].contains("W2") && ramos[0].contains("pubspec"));
    assert!(ramos[1].contains("W2m-1") && ramos[1].contains("next"));
    assert!(ramos[2].contains("retry") || ramos[2].contains("mesma"));
    assert!(ramos[3].contains("aborto") || ramos[3].contains("dry-run"));

    // Ramo 1 — W2
    assert_eq!(proxima(Ecra::W2, &Contexto { has_pubspec: true, ..Contexto::default() }), Ecra::W3);
    assert_eq!(proxima(Ecra::W2, &Contexto::default()), Ecra::W2m1);
    // Ramo 2 — W2m-1
    assert_eq!(proxima(Ecra::W2m1, &Contexto { encadeia: true, ..Contexto::default() }), Ecra::W2m2);
    assert_eq!(proxima(Ecra::W2m1, &Contexto::default()), Ecra::W3);
}

#[test]
fn retry_repete_a_mesma_pergunta_nao_e_voltar() {
    let invalido = Contexto { invalido: true, ..Contexto::default() };
    assert_eq!(proxima(Ecra::W2m1, &invalido), Ecra::W2m1);
    assert_eq!(proxima(Ecra::W2m2, &invalido), Ecra::W2m2);
    assert_eq!(proxima(Ecra::W3, &invalido), Ecra::W3);
    let rotulos = transicoes_permitidas().join("\n");
    assert!(!rotulos.contains("voltar"), "rótulo 'voltar' proibido");
    assert!(!rotulos.contains("pular"), "rótulo 'pular' proibido");
}

#[test]
fn aborto_e_dry_run_encerram_sem_transicao_nova() {
    let aborto = Contexto { aborto: true, ..Contexto::default() };
    for ecra in [Ecra::W0, Ecra::W2, Ecra::W2m1, Ecra::W3, Ecra::W4, Ecra::W5] {
        assert_eq!(proxima(ecra, &aborto), Ecra::Aborto, "aborto em {:?}", ecra);
    }
    let seco = Contexto { dry_run: true, ..Contexto::default() };
    assert_eq!(proxima(Ecra::W5, &seco), Ecra::Fim, "dry-run encerra sem W6/W7");
    assert_eq!(proxima(Ecra::Aborto, &Contexto::default()), Ecra::Aborto);
    assert_eq!(proxima(Ecra::Fim, &Contexto::default()), Ecra::Fim);
}

#[test]
fn report_verdict_nunca_e_gate() {
    let ctx = Contexto { has_pubspec: false, encadeia: true, ..Contexto::default() };
    for veredito in ["PASS", "FAIL", "flagged-open", "arbitrário"] {
        assert_eq!(proxima_ignorando_verdict(Ecra::W4, &ctx, veredito), Ecra::W5);
    }
}
