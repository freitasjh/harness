// 4 entrypoints (ADR-003 §2.2). DUAS ordens congeladas, uma por entrypoint:
// runUpgrade planeja ANTES de backup; main faz backup ANTES de planejar.
// Uni-las é reescrita proibida (BF-02b/EX-BE-05).
pub mod cli;
pub mod init;
pub mod main;
pub mod support;
pub mod upgrade;
pub mod wizard;
