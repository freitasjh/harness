---
description: Migra um projeto para o layout atual do harness
---

1. Descubra o target e confirme que ele contém um layout antigo do harness.
2. Rode `node scripts/harness-sync.mjs migrate --target $ARGUMENTS --dry-run`.
3. Mostre o plano e peça confirmação ao operador.
4. Rode sem `--dry-run`.
5. Rode `node scripts/harness-sync.mjs doctor --target <dir>` e reporte.
