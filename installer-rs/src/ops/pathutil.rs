// path.resolve / realpath equivalentes ao Node para as operações de leitura.
// Sem crate externa: apenas std, para não introduzir texto novo de erro/help.

pub fn resolve_path(p: &str) -> String {
    let absolute = if p.starts_with('/') {
        p.to_string()
    } else {
        let cwd = std::env::current_dir()
            .map(|c| c.to_string_lossy().to_string())
            .unwrap_or_else(|_| "/".to_string());
        format!("{}/{}", cwd.trim_end_matches('/'), p)
    };
    let mut parts: Vec<&str> = Vec::new();
    for part in absolute.split('/') {
        match part {
            "" | "." => {}
            ".." => { parts.pop(); }
            _ => parts.push(part),
        }
    }
    format!("/{}", parts.join("/"))
}

pub fn safe_real(p: &str) -> String {
    match std::fs::canonicalize(p) {
        Ok(c) => c.to_string_lossy().to_string(),
        Err(_) => resolve_path(p),
    }
}

pub fn str_arg<'a>(req: &'a crate::contract::Request, key: &str) -> Option<&'a str> {
    req.args.get(key).and_then(|v| v.as_str())
}

pub fn bool_arg(req: &crate::contract::Request, key: &str) -> bool {
    req.args.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = mp + if mp < 10 { 3 } else { -9 };
    (y + if m <= 2 { 1 } else { 0 }, m, d)
}

/// Equivalente a `new Date().toISOString().replace(/[:.]/g, '-')` do oráculo.
fn now_parts() -> (i64, i64, i64, i64, i64, i64, i64) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let secs = now / 1000;
    let days = secs / 86400;
    let sod = secs % 86400;
    let (y, m, d) = civil_from_days(days);
    (y, m, d, sod / 3600, (sod % 3600) / 60, sod % 60, now % 1000)
}

pub fn iso_stamp_compact() -> String {
    let (y, m, d, h, mi, s, ms) = now_parts();
    format!("{:04}-{:02}-{:02}T{:02}-{:02}-{:02}-{:03}Z", y, m, d, h, mi, s, ms)
}

/// `new Date().toISOString()` — usado em manifest.date.
pub fn iso_z() -> String {
    let (y, m, d, h, mi, s, ms) = now_parts();
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z", y, m, d, h, mi, s, ms)
}
