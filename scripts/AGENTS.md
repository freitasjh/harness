# scripts/ — chunk de escopo (ADR-003 AGENTSMD-01)

Carrega quando o cwd está em `scripts/`. Raiz `AGENTS.md` continua válida e vem primeiro.

## Convenções do eixo

- Teste antes de código; nome `when{Action}_then{Expected}` quando aplicável.
- `harness-sync.mjs`: `writeGuarded` é a única via de escrita; manifesto é o último write.
- `codex-support.mjs`: helpers puros, sem rede e sem escrita; cada consumidor passa seus paths.
- Temp com `tempScope` e `cleanup()` em `afterEach`; zero rede, zero porta.
- Nenhum `pkill -f`; encerrar portas por PID via `lsof -ti :PORT` → conferir dono → `kill`.
- checks: `node --test "scripts/__tests__/*.spec.mjs"`, `static-checks`, `sdd-checks`, `vendor-skills --check`, `acceptance-clean-room`.
