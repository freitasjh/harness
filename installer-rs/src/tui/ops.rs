//! As 8 `op`s de TUI (ADR-001 §5 / D-TUI, ADR-004 §2.3, RF-04/11/12).
//!
//! Leitura, formatação e interpelação — nunca escrita. `apply` fica no motor
//! (ADR-003). Os nomes e a ordem são os de `contract-inventory.mjs::TUI`;
//! o despacho é 1:1 e nenhuma op desta classe grava arquivo ou toca terminal.

use crate::contract::Request;
use crate::error::EngineError;
use crate::tui::secret;
use crate::text::error::{format_error, ErrorParts};
use crate::text::usage::usage_lines;
use serde_json::{json, Map, Value};
use std::path::Path;

fn arg<'a>(req: &'a Request, key: &str) -> Option<&'a Value> {
    req.args.get(key)
}

fn text<'a>(req: &'a Request, key: &str) -> &'a str {
    arg(req, key).and_then(Value::as_str).unwrap_or("")
}

fn flag(req: &Request, key: &str) -> bool {
    arg(req, key).and_then(Value::as_bool).unwrap_or(false)
}

fn menu_item_line(item: &Value, width: usize) -> String {
    let key = item.get("key").and_then(Value::as_str).unwrap_or("");
    let label = item.get("label").and_then(Value::as_str).unwrap_or("");
    let note = item.get("note").and_then(Value::as_str).unwrap_or("");
    let anchor = if let Some(next) = item.get("next").and_then(Value::as_str) {
        format!("segue: {}", next)
    } else {
        format!("stack {}", item.get("stack").and_then(Value::as_str).unwrap_or(""))
    };
    let extra = if note.is_empty() { String::new() } else { format!(" ({})", note) };
    format!("  {}) {:<width$} -> {}{}", key, label, anchor, extra, width = width)
}

fn menu_choices(count: usize) -> String {
    if count == 0 { return String::new() }
    let keys: Vec<String> = (1..=count).map(|n| n.to_string()).collect();
    if count == 1 { return keys[0].clone() }
    format!("{} ou {}", keys[..count - 1].join(", "), keys[count - 1])
}

/// W2m-1/W2m-2 — prompt `[i/total] escolha [1-N] (default: N) (q cancela) > `,
/// range derivado de `items.length`, retry da MESMA pergunta com erro 4-linhas.
pub fn ask_menu_step(req: &Request) -> Result<Value, EngineError> {
    let items = arg(req, "items").and_then(Value::as_array).cloned().unwrap_or_default();
    let step = arg(req, "step").and_then(Value::as_u64).unwrap_or(1);
    let total = arg(req, "total").and_then(Value::as_u64).unwrap_or(2);
    let width = arg(req, "width").and_then(Value::as_u64).unwrap_or(0) as usize;
    let default_key = text(req, "defaultKey");
    let shown_default = if default_key.is_empty() { String::new() } else { format!(" (default: {})", default_key) };
    let range = format!("1-{}", items.len());
    let prompt = format!("[{}/{}] escolha [{}]{} (q cancela) > ", step, total, range, shown_default);

    let mut lines: Vec<String> = Vec::new();
    if !text(req, "header").is_empty() { lines.push(text(req, "header").to_string()) }
    for item in &items { lines.push(menu_item_line(item, width)) }

    let choice = text(req, "choice");
    let fallback = if choice.is_empty() && !default_key.is_empty() {
        items.iter().find(|i| i.get("key").and_then(Value::as_str) == Some(default_key))
    } else {
        items.iter().find(|i| i.get("key").and_then(Value::as_str) == Some(choice))
    };
    let picked = match fallback {
        Some(item) => item.clone(),
        None => {
            let parts = ErrorParts {
                what: &format!("opcao '{}' invalida — digite {} (ou 'q' para cancelar).", choice, menu_choices(items.len())),
                code: "BAD_ANSWER",
                why: &format!("fora de [{}]", range.replace('-', ",")),
                fix: "escolha o numero de um dos itens listados acima (ou q para cancelar).",
                where_: "installer/install.mjs (W2m)",
            };
            for line in format_error(&parts, arg(req, "answers")).lines() { lines.push(line.to_string()) }
            json!(null)
        }
    };
    Ok(json!({ "prompt": prompt, "lines": lines, "picked": picked }))
}

/// W2 — presença/leitura de `pubspec.yaml`; nenhuma escrita, nenhum segredo.
pub fn detect(req: &Request) -> Result<Value, EngineError> {
    let target = req.target.as_deref().unwrap_or_else(|| text(req, "target"));
    let pubspec = Path::new(target).join("pubspec.yaml");
    let mut result = json!({
        "hasPubspec": pubspec.is_file(),
        "name": Value::Null, "sdk": Value::Null, "declaresFlutter": false,
        "suggestedStack": Value::Null, "sources": [], "warnings": [],
    });
    if result["hasPubspec"].as_bool() != Some(true) { return Ok(result) }
    let texto = match std::fs::read_to_string(&pubspec) {
        Ok(t) => t,
        Err(_) => {
            result["warnings"] = json!(["pubspec.yaml: ilegivel"]);
            return Ok(result);
        }
    };
    let mut in_environment = false;
    let mut sources: Vec<Value> = Vec::new();
    for (i, raw) in texto.lines().enumerate() {
        let line = raw.split('#').next().unwrap_or("").to_string();
        if let Some(rest) = line.strip_prefix("name:") {
            if result["name"].is_null() {
                result["name"] = json!(rest.trim().trim_matches(['"', '\'']));
                sources.push(json!({ "field": "project", "file": "pubspec.yaml", "line": i + 1 }));
            }
        }
        if line.trim() == "environment:" { in_environment = true; continue }
        if in_environment && !line.trim().is_empty() && !line.starts_with(char::is_whitespace) { in_environment = false }
        if in_environment {
            if let Some(rest) = line.trim().strip_prefix("sdk:") {
                result["sdk"] = json!(rest.trim().trim_matches(['"', '\'']));
                sources.push(json!({ "field": "environment.sdk", "file": "pubspec.yaml", "line": i + 1 }));
                in_environment = false;
            }
        }
        if line.trim() == "flutter:" || line.trim() == "sdk: flutter" {
            result["declaresFlutter"] = json!(true);
            sources.push(json!({ "field": "stack", "file": "pubspec.yaml", "line": i + 1 }));
        }
    }
    let flutter = result["declaresFlutter"].as_bool().unwrap_or(false);
    result["suggestedStack"] = json!(if flutter { "flutter" } else { "dart" });
    result["sources"] = json!(sources);
    Ok(result)
}

/// W4 — prévia do plano: `counts`, `total` e linhas sanitizadas. Redação com
/// vigentes antes de qualquer saída (MUSTFIX-3).
pub fn print_plan(req: &Request) -> Result<Value, EngineError> {
    let plan = arg(req, "plan").and_then(Value::as_array).cloned().unwrap_or_default();
    let answers = arg(req, "answers").cloned().unwrap_or_else(|| req.answers.clone());
    let mut counts = Map::new();
    let mut lines: Vec<String> = vec!["plano de instalacao:".into()];
    for step in &plan {
        let action = step.get("action").and_then(Value::as_str).unwrap_or("");
        let path = step.get("path").and_then(Value::as_str).unwrap_or("");
        let reason = step.get("reason").and_then(Value::as_str).unwrap_or("");
        let extra = if reason.is_empty() { String::new() } else { format!(" — {}", reason) };
        lines.push(format!("  {}  {}{}", action, path, extra));
        *counts.entry(action.to_string()).or_insert(json!(0)) = json!(counts.get(action).and_then(Value::as_u64).unwrap_or(0) + 1);
    }
    let summary = counts.iter().map(|(k, v)| format!("{}={}", k, v.as_u64().unwrap_or(0))).collect::<Vec<_>>().join(" ");
    lines.push(format!("resumo: {} itens ({})", plan.len(), if summary.is_empty() { "vazio".into() } else { summary }));
    lines.push("classes: create (novo), merge (aditivo), flag (humano resolve)".into());
    let lines: Vec<String> = lines.iter().map(|l| {
        let mut out = l.clone();
        for q in crate::ops::registry::QUESTIONS.iter().filter(|q| q.secret) {
            if let Some(v) = answers.get(q.key).and_then(Value::as_str) {
                if !v.is_empty() { out = secret::sanitize_log(&out, v) }
            }
        }
        out
    }).collect();
    Ok(json!({ "counts": counts, "total": plan.len(), "lines": lines }))
}

/// `printUsage` (9 linhas literais de text/usage.rs).
pub fn print_usage(_req: &Request) -> Result<Value, EngineError> {
    Ok(json!({ "lines": usage_lines() }))
}

/// W3 — interpelação: respostas scriptadas entram pelo pedido; o segredo é
/// omitido do resultado (`serializeSkips`) e `q` aborta (USER_ABORT).
pub fn prompt_answers(req: &Request) -> Result<Value, EngineError> {
    if text(req, "abortToken").eq_ignore_ascii_case("q") {
        return Err(EngineError::new("USER_ABORT", "q cancela o wizard", "aborto do operador", "rerode para continuar"));
    }
    let scripted = arg(req, "scripted").cloned().unwrap_or_else(|| req.answers.clone());
    let mut inner = Request {
        v: 1,
        op: "collectAnswers".into(),
        args: json!({ "target": text(req, "target"), "scripted": scripted }),
        answers: scripted.clone(),
        target: req.target.clone(),
    };
    if text(req, "target").is_empty() { inner.args["target"] = json!(req.target.as_deref().unwrap_or("")); }
    let collected = crate::ops::answers::collect(&inner)?;
    let _ = flag(req, "serializeSkips");
    Ok(secret::serialize_skips(&collected, true))
}

/// Prompt do segredo — literal congelado (transcript `:38`), espaço final.
pub fn read_secret_prompt(req: &Request) -> Result<Value, EngineError> {
    let prompt = if text(req, "prompt").is_empty() { secret::prompt_de_segredo().trim_end().to_string() } else { text(req, "prompt").to_string() };
    let tty = flag(req, "tty");
    let raw = flag(req, "rawMode");
    Ok(json!({
        "prompt": format!("{} ", prompt),
        "canNoEcho": secret::can_no_echo(tty, raw),
    }))
}

/// Leitura sem eco (máscara); `q` é USER_ABORT; nenhum valor cru no envelope.
pub fn read_secret_raw(req: &Request) -> Result<Value, EngineError> {
    let mask = if text(req, "mask").is_empty() { "*".to_string() } else { text(req, "mask").to_string() };
    if !flag(req, "tty") || !flag(req, "rawMode") {
        return Err(EngineError::new("SECRET_TTY", "leitura sem eco exige stdin TTY", "sem raw mode", "rode interativo"));
    }
    if secret::is_abort_token(text(req, "input")) {
        return Err(EngineError::new("USER_ABORT", "segredo cancelado", "q no segredo", "rerode para continuar"));
    }
    Ok(json!({ "mask": mask, "maskLen": text(req, "input").chars().count(), "qAborta": true }))
}

/// `sourceLineOf` — última ocorrência do marcador no arquivo (bloco, não
/// declaração). Leitura pura; caminho vem do pedido, nunca de argv visível.
pub fn source_line_of(req: &Request) -> Result<Value, EngineError> {
    let caminho = text(req, "path");
    let marcador = text(req, "marker");
    if caminho.is_empty() || marcador.is_empty() {
        return Ok(json!({ "line": Value::Null }));
    }
    let linha = std::fs::read_to_string(caminho).ok().and_then(|s| {
        let linhas: Vec<&str> = s.lines().collect();
        linhas.iter().enumerate().rev()
            .find(|(_, l)| l.contains(marcador))
            .map(|(i, _)| i + 1)
    });
    Ok(json!({ "line": linha }))
}
