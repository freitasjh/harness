# Parecer UX — prd-installer-rust-adr-004 (vinculante)

> Fonte: subagente `ux-designer`, fonte da verdade visual. Skills `ui-ux-pro-max` + `frontend-design`. Design System Pulse. Data 2026-11-16.

## Veredito
Jornada já sólida. Atrito real em **E** (estado) e **A** (meio), não em **C** nem **P**. **Zero mudança de byte** recomendada.

## Análise do visual existente
10 telas × 5 campos (I identidade · C conteúdo · P prompt/ações · E estado · A acessibilidade/meio), 50 campos preenchidos. Heurísticas já atendidas: Progress Indicators (`[1/2]`, `[i/5]`, `[i/total]`), Form Labels (pergunta+range+default no prompt), Escape routes (`(q cancela)`), color-not-only (prefixos `[OK]/[INFO]/[AVISO]/[ERRO]`), Submit Feedback (W4 prévia, W6 `[i/total]`, W7 veredito), Pico-Fim (W0/W7), Jakob (line-based = modelo mental de CLI).

## Melhorias permitidas (custo 0 no transcript)
| # | Tela/campo | Melhoria |
|---|---|---|
| M1 | todas/E | estado declarativo no **envelope**, nunca em `stderr` |
| M2 | W1/C | 7 `[AVISO]` como sequência informativa, não falha |
| M3 | W2/E | ramo `sem pubspec → W2m-1` / `com pubspec → W3` como dado de estado |
| M4 | W2m-1,W2m-2,W3/P | retry da **mesma** pergunta com `formatError`; `q` válido no segredo; nenhuma mensagem inédita |
| M5 | W4/C,E | prévia em `stderr` + plano estruturado no envelope; não paginar as 218 linhas |
| M6 | W5/E,A | 0 writes antes da confirmação; aborto/dry-run por construção |
| M7 | W6,W7/E | `[i/total]` e `[OK|ERRO] PASS|FAIL` como únicos sinais; sem spinner/barra |
| M8 | todas/A | cleanup idempotente antes de leitura sem eco; `SIGTERM` com prompt aberto ⇒ sinal, nunca exit 0 |

Inovação máxima: **M1 + M8** (modelo interno e robustez de meio, invisíveis no transcript).

## Fluxo W0→W7
Ordem exata de `runWizard`, **0 transição nova**. Ramos medidos: (1) W2 com/sem pubspec; (2) W2m-1 com/sem `next`; (3) retry da mesma pergunta em W2m-1/2/W3; (4) aborto/dry-run. Nenhum quinto ramo. `voltar`/`pular` proibidos.

## Acessibilidade / segredo / cleanup (campo A)
- **TTY**: `r.close()` → leitura sem eco → novo reader; `q` cancela também no segredo (`USER_ABORT`); `[OK] deployToken = [REDACTED]`; foco no `> `.
- **Pipe**: sem `setRawMode`; `serializeSkips` ⇒ `deployToken` ausente do envelope; `sanitizeLog` ⇒ `token=[REDACTED]`; nenhum prompt em `stdout`.
- **Cleanup (R5)**: handler idempotente registrado **antes** da leitura sem eco; cobre SIGTERM/SIGINT/EOF/erro; prova PTY com `kill -TERM` ⇒ eco restaurado + `stty -a` + `ExitStatus` com sinal. Sem handler ⇒ rejeitar.

## Gotchas byte-level
Prompts terminam em espaço (`:19`,`:24`,`:38`) — não trimar. Transcript tem `\r` (`:20`) — não normalizar. `stripAnsi="AB"` é capacidade de sanitização, não licença para cor (SI-4 é `diff` sem strip).

## Pulse
Adoção semântica, sem escape ANSI: `success`→`[OK]`, `warning`→`[AVISO]`, `danger`→`[ERRO]`, muted→`[INFO]`. Âmbar reservado à **ação** (`> `), nunca rótulo passivo. Dark mode = emulador. Tipografia não se aplica (texto plano).

## Fora de escopo (congelado)
Widget/tela cheia · prompt/default/range/mensagem/tecla novo · correção de acentuação (`nada sera aplicado`, `Diretorio`, `deteccao`) · paginar W4 · spinner/barra · `voltar`/`pular`/ramo novo · crate/versão/toolchain · tela chamando `applyMerge`/`writeManifest`/`fs.write` · segredo por argv.
