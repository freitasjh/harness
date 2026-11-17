// CLI-03 — ponte entre a tela (ADR-002) e os eixos da ADR-001.
// Fonte única de seleção: AXIS_IDS (8 backends × 6 frontends). Nenhuma tabela
// casada de perfis participa da escolha. A config é gerada por generateConfig
// da ADR-001 (mesmo literal do item 5 da interface congelada), com commands do
// backend e mcp do frontend.
import { AXIS_IDS, generateConfig } from '../installer-contract.mjs'

export const BACKEND_EIXOS = Object.freeze([...AXIS_IDS.backend])
export const FRONTEND_EIXOS = Object.freeze([...AXIS_IDS.frontend])

export const DEFAULTS = Object.freeze({ backend: 'java', frontend: 'react' })

export function choicesForEixo(eixo, axes) {
  const source = axes ? axes[eixo] : eixo === 'backend' ? BACKEND_EIXOS : FRONTEND_EIXOS
  if (!Array.isArray(source)) throw new Error(`eixos.js: eixo desconhecido: ${eixo}`)
  return source.map((value) => ({ name: value, value }))
}

export function configFromSelection({ backend, frontend }, project = 'demo') {
  return generateConfig({ project, axes: { backend, frontend } })
}
