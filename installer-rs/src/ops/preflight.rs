// Oráculo: install.mjs:52-90 @ c63e333. Somente leitura (0 writes).
use crate::contract::Request;
use crate::error::EngineError;
use crate::ops::pathutil::{bool_arg, resolve_path, str_arg};
use serde_json::{json, Value};

const MIN_NODE_VERSION: [i64; 3] = [20, 0, 0];
const MANIFEST_NAME: &str = ".harness-install.json";

fn parse_node(v: &str) -> [i64; 3] {
    let s = v.strip_prefix('v').unwrap_or(v);
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() < 3 {
        return [0, 0, 0];
    }
    let mut out = [0i64; 3];
    for (i, p) in parts.iter().take(3).enumerate() {
        out[i] = p.parse().unwrap_or(0);
    }
    out
}

fn gte(a: [i64; 3], b: [i64; 3]) -> bool {
    for i in 0..3 {
        if a[i] > b[i] { return true; }
        if a[i] < b[i] { return false; }
    }
    true
}

fn has_dotdot(target: &str) -> bool {
    target.split(|c| c == '/' || c == '\\').any(|seg| seg == "..")
}

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target = str_arg(req, "target").unwrap_or("").trim();
    if target.is_empty() {
        return Err(EngineError::new("BAD_TARGET", "missing --target", "--target obrigatório", "informe --target"));
    }
    if has_dotdot(target) {
        return Err(EngineError::new(
            "OUTSIDE_TARGET",
            format!("target escapes (.. segment): {}", target),
            "segmento .. não é aceito antes do resolve",
            "informe caminho absoluto sem ..",
        ));
    }
    let resolved = resolve_path(target);

    let version = str_arg(req, "nodeVersion").unwrap_or("0.0.0");
    let ver = parse_node(version);
    if !gte(ver, MIN_NODE_VERSION) {
        return Err(EngineError::new(
            "NODE_MIN",
            format!("node minimum {}.{}.{} required, got {}.{}.{} (G1/Y2)",
                MIN_NODE_VERSION[0], MIN_NODE_VERSION[1], MIN_NODE_VERSION[2], ver[0], ver[1], ver[2]),
            "runtime abaixo do mínimo",
            "atualize o runtime",
        ));
    }

    let uid = req.args.get("uid").and_then(|v| v.as_i64()).unwrap_or(1000);
    let allow_root = bool_arg(req, "allowRoot");
    if uid == 0 && !allow_root {
        return Err(EngineError::new(
            "UID_ROOT",
            "refusing to run as uid 0 without --allow-root (Y2)",
            "uid 0 sem --allow-root",
            "use --allow-root",
        ));
    }

    if !bool_arg(req, "skipManifestGuard") {
        let manifest = format!("{}/{}", resolved.trim_end_matches('/'), MANIFEST_NAME);
        if std::path::Path::new(&manifest).exists() {
            let ours = std::fs::read_to_string(&manifest)
                .ok()
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                .map(|v| {
                    v.get("manifestSchemaVersion").and_then(|x| x.as_i64()) == Some(1)
                        && v.get("source").and_then(|x| x.as_str()).is_some()
                })
                .unwrap_or(false);
            if ours {
                return Err(EngineError::new(
                    "REINSTALL",
                    format!("re-install detected ({} exists). See manifest backupDir; remove or run upgrade path. Aborting.", MANIFEST_NAME),
                    "manifesto próprio já presente",
                    "use o caminho de upgrade",
                ));
            }
            return Err(EngineError::new(
                "FOREIGN_MANIFEST",
                format!("foreign manifest {} exists (not ours). Human must resolve before install. Aborting.", MANIFEST_NAME),
                "manifesto de outra ferramenta",
                "resolva manualmente",
            ));
        }
    }

    Ok(json!({ "target": resolved, "uid": uid }))
}
