// backup / requireVerifiedBackup (install.mjs:165-186, :1599-1603 @ c63e333).
// I2: nenhuma escrita de conteúdo sem verified === true; injectFailure ⇒
// BACKUP_FAIL com 0 writes e destino intacto; backup vive FORA do target.
use crate::contract::{parse_request, Request};
use crate::error::EngineError;
use crate::ops::pathutil::{bool_arg, str_arg};
use serde_json::{json, Value};
use std::path::Path;

const BACKUP_TRACKED: [&str; 5] = [
    "opencode.json", "harness.config.json", ".agents", ".opencode", ".harness-install.json",
];

fn req_for(op: &str, args: Value, target: &str) -> Request {
    let text = format!(
        "{{\"v\":1,\"op\":\"{}\",\"args\":{},\"answers\":{{}},\"target\":{}}}",
        op, args, json!(target)
    );
    parse_request(&text).expect("request interno de backup")
}

fn copy_entry(src: &Path, dst: &Path) -> std::io::Result<()> {
    if src.is_dir() {
        copy_dir(src, dst)
    } else {
        if let Some(p) = dst.parent() { std::fs::create_dir_all(p)?; }
        std::fs::copy(src, dst).map(|_| ())
    }
}

fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for e in std::fs::read_dir(src)? {
        let e = e?;
        let child_src = e.path();
        let child_dst = dst.join(e.file_name());
        if child_src.is_dir() {
            copy_dir(&child_src, &child_dst)?;
        } else {
            if let Some(p) = child_dst.parent() { std::fs::create_dir_all(p)?; }
            std::fs::copy(&child_src, &child_dst)?;
        }
    }
    Ok(())
}

pub fn backup(target: &str, backup_root: Option<&str>, inject_failure: bool) -> Result<Value, EngineError> {
    if inject_failure {
        return Err(EngineError::new(
            "BACKUP_FAIL",
            "backup failed (injected): aborting before any write (I1)",
            "falha injetada no backup",
            "rerode sem injectFailure",
        ));
    }
    let resolved = crate::ops::pathutil::resolve_path(target);
    let bdir = crate::ops::backup_dir::run(&req_for(
        "resolveBackupDir",
        json!({"target": resolved, "backupRoot": backup_root}),
        &resolved,
    ))?;
    let dir = bdir.as_str().unwrap_or("").to_string();
    if let Err(e) = std::fs::create_dir_all(&dir) {
        return Err(EngineError::new("BACKUP_FAIL", format!("backup mkdir failed: {}", e), "diretório de backup não criado", "verifique permissões"));
    }
    let mut copied = Vec::new();
    for rel in BACKUP_TRACKED {
        let src = Path::new(&resolved).join(rel);
        if !src.exists() { continue; }
        let dst = Path::new(&dir).join(rel);
        if copy_entry(&src, &dst).is_err() {
            return Err(EngineError::new("BACKUP_FAIL", format!("backup copy failed: {}", rel), "cópia falhou", "rerode o backup"));
        }
        copied.push(rel);
    }
    if !Path::new(&dir).exists() {
        return Err(EngineError::new("BACKUP_FAIL", "backup verification failed: dir missing (I1)", "diretório ausente", "rerode o backup"));
    }
    Ok(json!({ "backupDir": dir, "copied": copied, "verified": true }))
}

pub fn require_verified_backup(bk: &Value) -> Result<String, EngineError> {
    if bk.get("verified").and_then(|v| v.as_bool()) != Some(true) {
        return Err(EngineError::new(
            "BACKUP_UNVERIFIED",
            "backup unverified: aborting before any write (I1/FU-20)",
            "backup não verificado",
            "rode backup antes de aplicar",
        ));
    }
    Ok(bk.get("backupDir").and_then(|v| v.as_str()).unwrap_or("").to_string())
}

pub fn run(req: &Request) -> Result<Value, EngineError> {
    let target = str_arg(req, "target").or(req.target.as_deref()).unwrap_or("");
    backup(target, str_arg(req, "backupRoot").or(str_arg(req, "backupDir")), bool_arg(req, "injectFailure"))
}

pub fn run_require(req: &Request) -> Result<Value, EngineError> {
    let bk = req.args.get("backup").cloned().unwrap_or_else(|| json!({}));
    Ok(json!(require_verified_backup(&bk)?))
}
