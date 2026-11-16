// Bloco de erro 4-linhas (ADR-003 item 7 / formatError install.mjs:1537-1544).
// Ordem congelada: strip ANSI → redigir segredos → 4 linhas. Texto é saída
// comparada ao oráculo; a crate nunca dita o conteúdo (§2.4.1).
use crate::error::render_error_code;
use crate::ops::registry::QUESTIONS;
use serde_json::Value;

pub struct ErrorParts<'a> {
    pub what: &'a str,
    pub code: &'a str,
    pub why: &'a str,
    pub fix: &'a str,
    pub where_: &'a str,
}

fn strip_ansi(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '\u{1b}' {
            if i + 1 < chars.len() && chars[i + 1] == '[' {
                i += 2;
                while i < chars.len() {
                    let x = chars[i];
                    if x.is_ascii_alphabetic() {
                        i += 1;
                        break;
                    }
                    i += 1;
                }
                continue;
            }
            if i + 2 < chars.len() && (chars[i + 1] == '(' || chars[i + 1] == ')') {
                i += 3;
                continue;
            }
            i += 1;
            continue;
        }
        let cp = c as u32;
        let control = cp == 127 || (cp <= 8) || (cp >= 11 && cp <= 31);
        if !control {
            out.push(c);
        }
        i += 1;
    }
    out
}

fn one_line(v: &str) -> String {
    strip_ansi(v).split_whitespace().collect::<Vec<&str>>().join(" ")
}

fn redact(line: &str, answers: Option<&Value>) -> String {
    let mut out = strip_ansi(line);
    if let Some(a) = answers {
        for q in QUESTIONS.iter().filter(|q| q.secret) {
            if let Some(v) = a.get(q.key).and_then(|x| x.as_str()) {
                if !v.is_empty() {
                    out = out.replace(v, "[REDACTED]");
                }
            }
        }
    }
    out
}

fn how_to_fix(key: &str) -> &'static str {
    match key {
        "project" => "informe um nome nao-vazio.",
        "stack" => "use node|java+vue|java+react|outra|node-esm|flutter|dart|rust|nestjs|node+react|nestjs+react|rust+react; flutter/dart exigem pubspec.yaml.",
        "suiteCommand" => "use um comando no PATH ou caminho de arquivo absoluto (ex: node).",
        "pluginsDir" => "informe um diretorio existente DENTRO do target.",
        _ => "revise o valor informado.",
    }
}

pub fn format_error(parts: &ErrorParts, answers: Option<&Value>) -> String {
    let known = render_error_code(parts.code);
    let what = one_line(parts.what);
    let why = one_line(parts.why);
    let fix_raw = if parts.fix.is_empty() {
        how_to_fix("")
    } else {
        parts.fix
    };
    let fix = one_line(fix_raw);
    let where_ = one_line(parts.where_);
    let lines = [
        format!("[ERRO] {}", if what.is_empty() { "erro no instalador" } else { &what }),
        format!("  porquê: {}{}", known, if why.is_empty() { String::new() } else { format!(": {}", why) }),
        format!("  como corrigir: {}", if fix.is_empty() { "revise o valor informado." } else { &fix }),
        format!("  onde ver: {}", if where_.is_empty() { "installer/install.mjs" } else { &where_ }),
    ];
    redact(&lines.join("\n"), answers)
}
