// 9 linhas literais de printUsage (install.mjs:2462-2470 @ c63e333).
// Texto é saída comparada (ADR-003 §2.4.1): nunca gerado pela crate de CLI.
pub const USAGE: [&str; 9] = [
    "uso: node installer/install.mjs init   --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]",
    "uso: node installer/install.mjs doctor   --target <dir> [--answers-file <json>] [--backup-dir <dir>] [--allow-root]",
    "uso: node installer/install.mjs upgrade --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]",
    "  init: greenfield create-only — so create|generate-overwrite|noop passam; merge|flag abortam com dica de doctor.",
    "  doctor: brownfield read-only — D0-D6 diagnostico, zero writes; ignora --dry-run/--yes.",
    "  upgrade: sobrescreve camadas gerenciadas pela versao atual do harness; backup automatico antes de escrever; idempotente; exige manifesto proprio.",
    "  sem --answers-file exige stdin interativo ou pipado; stdin fechado aborta sem escrever.",
    "  --dry-run: zero writes (nem backup cria); imprime plano + relatorio.",
    "  legado (sem init|doctor): node installer/install.mjs --target <dir> [--dry-run] [--answers-file <json>] [--yes] [--backup-dir <dir>] [--allow-root]",
];

pub fn usage_lines() -> Vec<String> {
    USAGE.iter().map(|s| s.to_string()).collect()
}

pub fn print_usage() {
    for line in USAGE {
        println!("{}", line);
    }
}
