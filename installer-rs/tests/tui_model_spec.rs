// TUI-01 — teste ANTES da implementação (ADR-004 §2.1, RF-01/05/10/17/18).
// 10 telas × 5 campos = 50 preenchidos; gotchas byte-level do parecer UX;
// nenhuma primitiva de escrita no módulo de tela (RF-05).
use harness_installer::tui::model::{campos, total_campos, TELAS};

const IDS: [&str; 10] = [
    "W0", "W1", "W2", "W2m-1", "W2m-2", "W3", "W4", "W5", "W6", "W7",
];

#[test]
fn dez_telas_cinco_campos_cinquenta_preenchidos() {
    assert_eq!(TELAS.len(), 10, "exatamente 10 telas");
    assert_eq!(total_campos(), 50, "10 × 5");
    let ids: Vec<&str> = TELAS.iter().map(|t| t.id).collect();
    assert_eq!(ids, IDS, "ids na ordem congelada de runWizard");

    let mut n = 0;
    for tela in &TELAS {
        let c = campos(tela);
        assert_eq!(c.len(), 5, "{} tem 5 campos I/C/P/E/A", tela.id);
        for (i, valor) in c.iter().enumerate() {
            assert!(!valor.trim().is_empty(), "{} campo {} vazio", tela.id, i);
            n += 1;
        }
    }
    assert_eq!(n, 50, "50 campos preenchidos");
}

#[test]
fn gotchas_byte_level_preservados_sem_ansi_sem_ramo_novo() {
    let w2m1 = TELAS.iter().find(|t| t.id == "W2m-1").unwrap();
    assert!(w2m1.prompt.ends_with(' '), "W2m-1: espaço final preservado (:19)");
    let w2m2 = TELAS.iter().find(|t| t.id == "W2m-2").unwrap();
    assert!(w2m2.prompt.ends_with(' '), "W2m-2: espaço final preservado (:24)");

    for tela in &TELAS {
        for valor in campos(tela) {
            assert!(!valor.contains('\u{1b}'), "{}: escape ANSI proibido (SI-4)", tela.id);
            assert!(!valor.contains("voltar"), "{}: ramo 'voltar' proibido", tela.id);
            assert!(!valor.contains("pular"), "{}: ramo 'pular' proibido", tela.id);
        }
    }
}

#[test]
fn modulo_de_tela_nao_tem_primitivas_de_escrita() {
    let fontes: [(&str, &str); 3] = [
        ("tui/model.rs", include_str!("../src/tui/model.rs")),
        ("tui/mod.rs", include_str!("../src/tui/mod.rs")),
        ("entry/wizard.rs", include_str!("../src/entry/wizard.rs")),
    ];
    let primitivas = [
        "std::fs::write", "fs::write", "File::create", "write_all",
        "OpenOptions", "apply_merge", "write_manifest", "backup(",
    ];
    for (nome, codigo) in fontes {
        for p in primitivas {
            assert!(!codigo.contains(p), "{} contém primitiva de escrita {}", nome, p);
        }
    }
}
