// Oráculo: install.mjs:146-165 @ c63e333 (resolveBackupDir). 0 writes.
use crate::contract::Request;
use crate::error::EngineError;
use crate::ops::pathutil::{iso_stamp_compact, resolve_path, safe_real, str_arg};
use serde_json::Value;

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target = resolve_path(str_arg(req, "target").unwrap_or(""));
    let t = target.trim_end_matches('/');

    if let Some(root) = str_arg(req, "backupRoot") {
        let dir = resolve_path(root);
        let d = dir.trim_end_matches('/');
        let real_t = safe_real(t);
        let real_d = safe_real(d);
        let rt = real_t.trim_end_matches('/');
        let rd = real_d.trim_end_matches('/');

        if d == t || rd == rt {
            return Err(EngineError::new(
                "BACKUP_FAIL", "backup dir must not equal target", "destino e backup iguais", "escolha outro diretório",
            ));
        }
        if d.starts_with(&format!("{}/", t)) || rd.starts_with(&format!("{}/", rt)) {
            return Err(EngineError::new(
                "BACKUP_FAIL", "backup dir must not live inside target (nested)", "backup dentro do target", "escolha diretório externo",
            ));
        }
        if t.starts_with(&format!("{}/", d)) || rt.starts_with(&format!("{}/", rd)) {
            return Err(EngineError::new(
                "BACKUP_FAIL", "target must not live inside backup dir (nested)", "target dentro do backup", "escolha diretório externo",
            ));
        }
        Ok(Value::String(dir))
    } else {
        let parent = t.rsplit_once('/').map(|(p, _)| if p.is_empty() { "/" } else { p }).unwrap_or("/");
        let base = t.rsplit('/').next().unwrap_or("");
        Ok(Value::String(format!(
            "{}/.harness-backup-{}-{}",
            parent.trim_end_matches('/'),
            base,
            iso_stamp_compact()
        )))
    }
}
