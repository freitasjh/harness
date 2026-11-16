//! Cleanup de terminal (ADR-004 §2.4 item 3, RF-09/06/18 — risco R5).
//!
//! Handler idempotente registrado ANTES de qualquer leitura sem eco. Cobre
//! SIGTERM, SIGINT, EOF e caminho de erro: restaura modo/eco via `tcsetattr`
//! (async-signal-safe) e, no caso de sinal, reaplica a disposição padrão e
//! reenvia o sinal — `ExitStatus` com sinal, NUNCA exit 0. Segunda chamada é
//! no-op. Nenhuma crate nova: FFI direta à libc do sistema.

use std::sync::atomic::{AtomicBool, AtomicI32, AtomicPtr, AtomicUsize, Ordering};

const STDIN_FD: i32 = 0;
const TCSANOW: i32 = 0;
const ECHO: u32 = 0o10;
const SIGINT: i32 = 2;
const SIGTERM: i32 = 15;
const SIG_DFL: usize = 0;

#[repr(C)]
#[derive(Clone, Copy)]
struct Termios {
    c_iflag: u32,
    c_oflag: u32,
    c_cflag: u32,
    c_lflag: u32,
    c_line: u8,
    c_cc: [u8; 32],
    c_ispeed: u32,
    c_ospeed: u32,
}

extern "C" {
    fn tcgetattr(fd: i32, t: *mut Termios) -> i32;
    fn tcsetattr(fd: i32, action: i32, t: *const Termios) -> i32;
    fn signal(sig: i32, handler: usize) -> usize;
    fn kill(pid: i32, sig: i32) -> i32;
    fn getpid() -> i32;
}

static ORIGINAL: AtomicPtr<Termios> = AtomicPtr::new(std::ptr::null_mut());
static RESTAURADO: AtomicBool = AtomicBool::new(false);
static REGISTROS: AtomicUsize = AtomicUsize::new(0);
static RESTAURACOES: AtomicUsize = AtomicUsize::new(0);
/// Sinal que interrompeu a leitura; 0 quando a restauração veio de EOF/erro.
static SINAL: AtomicI32 = AtomicI32::new(0);

unsafe extern "C" fn ao_sinal(sig: i32) {
    SINAL.store(sig, Ordering::SeqCst);
    // FU-ADR004-02: tcsetattr/signal/kill são async-signal-safe; free() não é.
    // No handler NÃO liberamos o Box — o ponteiro é preservado e o processo
    // terminará pelo sinal. A liberação (drop) fica só no caminho normal.
    restaurar_estado_signal_safe();
    signal(sig, SIG_DFL);
    kill(getpid(), sig);
}

/// Restauração efetiva e idempotente. `liberar=false` é o caminho do sinal:
/// só `tcsetattr` (async-signal-safe), sem `free()` e sem troca do ponteiro.
fn restaurar_estado_com_free(liberar: bool) {
    if RESTAURADO.swap(true, Ordering::SeqCst) {
        return;
    }
    let p = ORIGINAL.load(Ordering::SeqCst);
    if !p.is_null() {
        unsafe { tcsetattr(STDIN_FD, TCSANOW, p) };
        if liberar {
            ORIGINAL.store(std::ptr::null_mut(), Ordering::SeqCst);
            unsafe { drop(Box::from_raw(p)) };
        }
    }
    RESTAURACOES.fetch_add(1, Ordering::SeqCst);
}

fn restaurar_estado() {
    restaurar_estado_com_free(true);
}

/// Caminho do handler de sinal: restaura sem liberar memória (R5).
pub fn restaurar_estado_signal_safe() {
    restaurar_estado_com_free(false);
}

/// Endereço do estado original (0 = nenhum capitalizado) — prova de que o
/// handler preservou o ponteiro em vez de chamar `free()`.
pub fn ponteiro_original() -> usize {
    ORIGINAL.load(Ordering::SeqCst) as usize
}

/// Registra o handler e capitaliza o estado original do terminal. Deve ser
/// chamado ANTES de `desativar_echo` / leitura sem eco.
pub fn register_cleanup() -> Guard {
    REGISTROS.fetch_add(1, Ordering::SeqCst);
    RESTAURADO.store(false, Ordering::SeqCst);
    SINAL.store(0, Ordering::SeqCst);

    // Sempre capitalizar um estado (zeroado quando não há TTY): o handler
    // precisa de um ponteiro estável e a prova do caminho sem-free é observável.
    let mut estado = std::mem::MaybeUninit::<Termios>::zeroed();
    let _ = unsafe { tcgetattr(STDIN_FD, estado.as_mut_ptr()) };
    let boxed = Box::into_raw(Box::new(unsafe { estado.assume_init() }));
    let anterior = ORIGINAL.swap(boxed, Ordering::SeqCst);
    if !anterior.is_null() {
        unsafe { drop(Box::from_raw(anterior)) };
    }
    unsafe {
        signal(SIGTERM, ao_sinal as usize);
        signal(SIGINT, ao_sinal as usize);
    }
    Guard
}

/// Guarda RAII: restaura em EOF e caminho de erro, sem depender de sinal.
pub struct Guard;

impl Drop for Guard {
    fn drop(&mut self) {
        restaurar_estado();
    }
}

/// Desativa apenas o bit ECHO; `ICANON` permanece para leitura por linha.
pub fn desativar_echo() {
    let p = ORIGINAL.load(Ordering::SeqCst);
    if p.is_null() {
        return;
    }
    let mut estado = unsafe { *p };
    estado.c_lflag &= !ECHO;
    unsafe { tcsetattr(STDIN_FD, TCSANOW, &estado) };
}

/// Restauração pública (EOF/erro); segunda chamada não corrompe estado.
pub fn restore_echo() {
    restaurar_estado();
}

/// Executa `f` com handler registrado ANTES da leitura — prova da ordem M8.
pub fn proteger_leitura<F: FnOnce() -> T, T>(f: F) -> T {
    let _guard = register_cleanup();
    f()
}

pub fn sinais_cobertos() -> &'static [&'static str] {
    &["SIGTERM", "SIGINT", "EOF", "erro"]
}

pub fn registros() -> usize {
    REGISTROS.load(Ordering::SeqCst)
}

pub fn restauracoes() -> usize {
    RESTAURACOES.load(Ordering::SeqCst)
}

pub fn sinal_interrompente() -> i32 {
    SINAL.load(Ordering::SeqCst)
}
