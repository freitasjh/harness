// Oráculo: install.mjs:1785-1797 (loadAnswersFile) e :667-717 (collectAnswers). 0 writes.
use crate::contract::Request;
use crate::error::EngineError;
use crate::ops::pathutil::{resolve_path, str_arg};
use serde_json::Value;

pub fn load(req: &Request) -> Result<Value, EngineError> {
    let raw_path = str_arg(req, "path")
        .or(str_arg(req, "answersFile"))
        .unwrap_or("");
    let path = resolve_path(raw_path);
    let raw = std::fs::read_to_string(&path).map_err(|_| {
        EngineError::new("BAD_ANSWER", format!("answers-file ilegivel: {}", raw_path), "arquivo ausente/ilegível", "informe --answers-file válido")
    })?;
    let parsed: Value = serde_json::from_str(&raw).map_err(|_| {
        EngineError::new("BAD_ANSWER", format!("answers-file invalido (JSON objeto esperado): {}", raw_path), "JSON inválido", "forneça objeto JSON")
    })?;
    if !parsed.is_object() {
        return Err(EngineError::new(
            "BAD_ANSWER", format!("answers-file invalido (JSON objeto esperado): {}", raw_path), "não é objeto", "forneça objeto JSON",
        ));
    }
    Ok(parsed)
}

// collectAnswers — oráculo install.mjs:667-717. 0 writes.
use crate::ops::registry::{self, AXIS_BACKEND, AXIS_FRONTEND, QUESTIONS, STACK_VALUES};
use std::path::Path;

fn resolve_under(base: &str, value: &str) -> String {
    if value.starts_with('/') {
        resolve_path(value)
    } else {
        resolve_path(&format!("{}/{}", base.trim_end_matches('/'), value))
    }
}

fn present(v: Option<&Value>) -> bool {
    v.and_then(|x| x.as_str()).map(|s| !s.is_empty()).unwrap_or(false)
}

fn command_resolves(cmd: &str) -> bool {
    let bin = cmd.trim().split_whitespace().next().unwrap_or("");
    if bin.is_empty() { return false; }
    if bin.contains('/') { return Path::new(bin).exists(); }
    let path = std::env::var("PATH").unwrap_or_default();
    for dir in path.split(':') {
        if Path::new(dir).join(bin).exists() { return true; }
    }
    false
}

fn pubspec_declares_flutter(text: &str) -> bool {
    for raw in text.split('\n') {
        let line = raw.split('#').next().unwrap_or("");
        let t = line.trim();
        if t == "sdk: flutter" || t.starts_with("sdk: flutter ") { return true; }
        if t == "flutter:" { return true; }
    }
    false
}

fn validate(target: &str, key: &str, value: &Value) -> Result<Option<Value>, EngineError> {
    let q = QUESTIONS.iter().find(|q| q.key == key).ok_or_else(|| {
        EngineError::new("BAD_ANSWER", format!("unknown question: {}", key), "chave fora de QUESTIONS", "use uma pergunta conhecida")
    })?;
    let empty = value.as_str().map(|s| s.trim().is_empty()).unwrap_or(true);
    if q.optional && empty { return Ok(None); }
    match q.kind {
        "name" => {
            if empty { return Err(EngineError::new("BAD_ANSWER", "project must be non-empty", "nome vazio", "informe o nome")); }
            Ok(Some(Value::String(value.as_str().unwrap().trim().to_string())))
        }
        "stack" => {
            let v = value.as_str().unwrap_or("");
            if !STACK_VALUES.contains(&v) {
                return Err(EngineError::new("BAD_ANSWER", format!("stack must be one of {}", STACK_VALUES.join("|")), "stack fora do conjunto", "escolha um preset"));
            }
            if v == "flutter" || v == "dart" {
                let pubspec = resolve_under(target, "pubspec.yaml");
                let text = std::fs::read_to_string(&pubspec).map_err(|_| {
                    EngineError::new("BAD_ANSWER", format!("stack {} requires pubspec.yaml in target (ADR-005)", v), "pubspec ausente", "adicione pubspec.yaml")
                })?;
                let declares = pubspec_declares_flutter(&text);
                if v == "flutter" && !declares {
                    return Err(EngineError::new("BAD_ANSWER", "pubspec.yaml sem \"sdk: flutter\": stack flutter exige projeto Flutter", "pubspec não declara flutter", "use stack dart"));
                }
                if v == "dart" && declares {
                    return Err(EngineError::new("BAD_ANSWER", "pubspec.yaml declara flutter: use stack \"flutter\"", "pubspec declara flutter", "use stack flutter"));
                }
            }
            Ok(Some(Value::String(v.to_string())))
        }
        "path" => {
            let p = resolve_under(target, value.as_str().unwrap_or(""));
            if p != target.trim_end_matches('/') && !p.starts_with(&format!("{}/", target.trim_end_matches('/'))) {
                return Err(EngineError::new("OUTSIDE_TARGET", format!("write outside target: {}", p), "fora do target", "use caminho relativo"));
            }
            if !Path::new(&p).exists() {
                return Err(EngineError::new("BAD_ANSWER", format!("path does not exist: {}", value.as_str().unwrap_or("")), "caminho ausente", "crie o caminho"));
            }
            Ok(Some(Value::String(p)))
        }
        "command" => {
            let cmd = value.as_str().unwrap_or("");
            if !command_resolves(cmd) {
                return Err(EngineError::new("BAD_ANSWER", format!("command does not resolve: {}", cmd), "comando não encontrado", "informe comando existente"));
            }
            Ok(Some(Value::String(cmd.to_string())))
        }
        "string" => Ok(Some(Value::String(value.as_str().unwrap_or("").to_string()))),
        "backend" => {
            let v = value.as_str().unwrap_or("");
            if !AXIS_BACKEND.contains(&v) {
                return Err(EngineError::new("BAD_ANSWER", format!("backend must be one of {}", AXIS_BACKEND.join("|")), "eixo inválido", "escolha eixo conhecido"));
            }
            Ok(Some(Value::String(v.to_string())))
        }
        "frontend" => {
            let v = value.as_str().unwrap_or("");
            if !AXIS_FRONTEND.contains(&v) {
                return Err(EngineError::new("BAD_ANSWER", format!("frontend must be one of {}", AXIS_FRONTEND.join("|")), "eixo inválido", "escolha eixo conhecido"));
            }
            Ok(Some(Value::String(v.to_string())))
        }
        _ => Ok(Some(value.clone())),
    }
}

pub fn collect(req: &Request) -> Result<Value, EngineError> {
    let target = req.args.get("target").and_then(|v| v.as_str())
        .or(req.target.as_deref()).unwrap_or("");
    let scripted = req.args.get("scripted").cloned().unwrap_or(Value::Null);
    let get = |k: &str| scripted.get(k).filter(|v| !v.is_null()).cloned();

    let has_stack = present(get("stack").as_ref());
    let has_backend = present(get("backend").as_ref());
    let has_frontend = present(get("frontend").as_ref());
    if has_backend != has_frontend {
        return Err(EngineError::new("BAD_ANSWER", "paired: backend and frontend must both be present", "backend/frontend devem vir juntos", "informe ambos"));
    }
    if !has_stack && !has_backend {
        return Err(EngineError::new("BAD_ANSWER", "missing answer: stack", "sem stack/axes", "informe stack"));
    }

    let mut answers = serde_json::Map::new();
    if has_stack {
        if let Some(v) = validate(target, "stack", &get("stack").unwrap())? { answers.insert("stack".into(), v); }
    }
    if has_backend {
        if let Some(v) = validate(target, "backend", &get("backend").unwrap())? { answers.insert("backend".into(), v); }
        if let Some(v) = validate(target, "frontend", &get("frontend").unwrap())? { answers.insert("frontend".into(), v); }
        let b = answers["backend"].as_str().unwrap_or("");
        let f = answers["frontend"].as_str().unwrap_or("");
        let preset = registry::preset_of_axes(b, f).ok_or_else(|| {
            EngineError::new("BAD_ANSWER", format!("no preset for axes {}+{}", b, f), "sem preset", "escolha axes válidos")
        })?;
        if !has_stack {
            answers.insert("stack".into(), Value::String(preset.to_string()));
        } else if answers["stack"].as_str() != Some(preset) {
            return Err(EngineError::new("BAD_ANSWER", "inconsistent stack vs axes", "stack e axes divergentes", "corrija as respostas"));
        }
    }

    for q in QUESTIONS.iter() {
        if matches!(q.key, "stack" | "backend" | "frontend") { continue; }
        let value = get(q.key);
        if q.secret && value.as_ref().map(|v| present(Some(v))).unwrap_or(false) == false {
            answers.insert(q.key.into(), Value::String(String::new()));
            continue;
        }
        if value.is_none() {
            if q.optional { continue; }
            return Err(EngineError::new("BAD_ANSWER", format!("missing answer: {}", q.key), "resposta obrigatória ausente", "informe todas as respostas"));
        }
        if let Some(v) = validate(target, q.key, value.as_ref().unwrap())? { answers.insert(q.key.into(), v); }
    }
    if let Some(v) = get("answersVersion") { answers.insert("answersVersion".into(), v); }

    // serializeAnswers (install.mjs:718-727): segredo nunca sai do envelope (I5).
    for q in QUESTIONS.iter().filter(|q| q.secret) { answers.remove(q.key); }
    Ok(Value::Object(answers))
}
