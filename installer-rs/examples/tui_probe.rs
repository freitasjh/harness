// Fixture de prova PTY para TUI-04/TUI-05 (ADR-004 §2.4). Não é op do
// dispatcher, não muda contract-v1 e não escreve arquivo: só segura a leitura
// sem eco com o handler registrado para o teste de sinal + stty -a.
use harness_installer::tui::secret;

fn main() {
    let modo = std::env::args().nth(1).unwrap_or_default();
    if modo != "secret" {
        return;
    }
    eprint!("{}", secret::prompt_de_segredo());
    let linha = secret::read_secret_no_echo();
    match secret::validar_token(&linha) {
        secret::TokenValor::Abortado => std::process::exit(1),
        secret::TokenValor::Valido(_) => {
            eprintln!("{}", secret::linha_redacted());
        }
    }
}
