// TUI-05 — teste ANTES da implementação (ADR-004 §2.4 item 3, RF-09/06/18 R5).
// Handler idempotente registrado ANTES da leitura sem eco; cobre SIGTERM/SIGINT/
// EOF/erro; 2ª chamada não corrompe estado. Prova PTY com sinal + stty -a fica
// no RELATÓRIO (script adr004-pty-proof.sh).
use harness_installer::tui::cleanup::{
    ponteiro_original, proteger_leitura, register_cleanup, restauracoes,
    restaurar_estado_signal_safe, restore_echo, sinais_cobertos,
};
use std::sync::Mutex;

// Estado do handler é global por processo: serializa os testes.
static LOCK: Mutex<()> = Mutex::new(());

#[test]
fn handler_registrado_antes_da_leitura_sem_eco() {
    let _l = LOCK.lock().unwrap();
    let valor = proteger_leitura(|| 42);
    assert_eq!(valor, 42, "leitura protegida executa");
    assert_eq!(sinais_cobertos(), ["SIGTERM", "SIGINT", "EOF", "erro"]);
}

#[test]
fn segunda_chamada_do_handler_nao_corrompe_estado() {
    let _l = LOCK.lock().unwrap();
    let _guard = register_cleanup();
    restore_echo();
    let uma = restauracoes();
    restore_echo();
    restore_echo();
    assert_eq!(restauracoes(), uma, "restauração é idempotente — 2ª chamada é no-op");
}

#[test]
fn ao_sinal_nao_chama_free_no_caminho_de_sinal() {
    let _l = LOCK.lock().unwrap();
    let antes = restauracoes();
    let _guard = register_cleanup();
    let ptr = ponteiro_original();
    assert_ne!(ptr, 0, "estado original capitalizado");
    restaurar_estado_signal_safe();
    assert_eq!(restauracoes(), antes + 1, "restauração ocorreu uma vez");
    assert_eq!(ponteiro_original(), ptr, "ponteiro PRESERVADO: free() não é chamado em handler de sinal");
}

#[test]
fn quatro_sinais_e_estado_de_guard() {
    let _l = LOCK.lock().unwrap();
    assert_eq!(sinais_cobertos().len(), 4, "SIGTERM/SIGINT/EOF/erro — nenhum 5º");
    let antes = restauracoes();
    drop(register_cleanup());
    drop(register_cleanup());
    assert_eq!(restauracoes(), antes + 2, "cada guard restaura exatamente uma vez");
}
