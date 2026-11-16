// Sob comando contract-v1 (ADR-001 §2.1): stdin JSON → stdout envelope JSON.
// `clap` escolhido por RESEARCH.md:13 (S1) sob critério ADR-003 §2.4; texto de
// help/erro da crate NÃO é autoridade — o oráculo vence (BE-04 fixa os textos).
use anyhow::Context;
use clap::Command;
use harness_installer::contract::{envelope_json, exit_code, parse_request};
use harness_installer::dispatcher::dispatch;

fn run() -> anyhow::Result<i32> {
    let matches = Command::new("harness-installer")
        .disable_help_flag(true)
        .disable_version_flag(true)
        .subcommand(Command::new("contract-v1"))
        .try_get_matches()
        .map_err(|_| anyhow::anyhow!("erro de protocolo: subcomando"))?;

    match matches.subcommand() {
        Some(("contract-v1", _)) => {}
        _ => {
            eprintln!("protocol: subcomando ausente");
            return Ok(2);
        }
    }

    let input = std::io::read_to_string(std::io::stdin()).context("leitura de stdin")?;
    let request = match parse_request(&input) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("protocol: {}", e);
            return Ok(2);
        }
    };
    let envelope = match dispatch(&request) {
        Ok(env) => env,
        Err(e) => {
            eprintln!("protocol: {}", e);
            return Ok(2);
        }
    };
    let code = exit_code(&envelope);
    println!("{}", envelope_json(&envelope));
    Ok(code)
}

fn main() {
    let code = match run() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("protocol: {e:#}");
            2
        }
    };
    std::process::exit(code);
}
