// Ops de engine — uma por arquivo. Escrita apenas em applyMerge/applyUpgrade
// (BE-06/BE-08), sempre depois de backup verificado (I2/I3).
pub mod answers;
pub mod args;
pub mod backup;
pub mod backup_dir;
pub mod checks;
pub mod config;
pub mod doctor;
pub mod incoming;
pub mod inventory;
pub mod manifest;
pub mod merge;
pub mod opencode;
pub mod agent_file;
pub mod pathutil;
pub mod preflight;
pub mod registry;
pub mod write;
