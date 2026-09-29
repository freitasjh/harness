# Frontend Coding Standards

Padrões de codificação para o frontend Atlas ECM (Vue 3 + TypeScript + shadcn-vue + Pinia).

> Substitui completamente padrão TaskFlow/Vuetify legado. **Vuetify é proibido** neste projeto — usar shadcn-vue.

## Stack definitiva

| Camada | Tecnologia | Obs |
|--------|------------|-----|
| Framework | Vue 3.5 + TypeScript | `<script setup lang="ts">` |
| UI | shadcn-vue (baseado em Radix Vue + Tailwind CSS) | Não usar Vuetify/PrimeVue |
| Estado | Pinia | Options ou Setup API |
| HTTP | axios + Vue Query (`@tanstack/vue-query`) opcional | `http` de `@/lib/axios` |
| Router | vue-router `createWebHistory` | lazy-loaded |
| i18n | vue-i18n `legacy: false` | `pt-BR` default |
| Form | vee-validate + zod | schema-first |
| Icons | lucide-vue-next | `Lucide*` |
| Build | Vite | alias `@` → `src/` |

## ESLint / Formatação

- `semi`: never (sem ponto e vírgula) — herdado, manter se já configurado; novo projeto usa Prettier + `eslint-config-prettier`
- `indent`: 2 espaços
- `comma-dangle`: always-multiline
- `camelcase`: error
- `@typescript-eslint/consistent-type-imports`: error
- `vue/multi-word-component-names`: off
- `vue/component-name-in-template-casing`: PascalCase
- Ícones: `lucide-vue-next` apenas, proibido `mdi-*` / `ri-*`
- `@core` / `@layouts` proibido — usar alias `@` simples

## Path Aliases (`vite.config.ts` + `tsconfig.json`)

| Alias | Path |
|-------|------|
| `@` | `src/` |
| `@images` | `src/assets/images/` |
| `@styles` | `src/assets/styles/` |

## Module Pattern

```
src/modules/{domain}/
  model/     → TS class/interface com defaults
  service/   → class-based ou composable com chamadas http
  store/     → Pinia store
  pages/     → layout + views
  components/→ componentes específicos do domínio
```

Para ECM, domínios: `tenant`, `identity`, `document`, `metadata`, `search`, `workflow`, `audit`.

### Model

```typescript
export default class Document {
  id: string | null
  title: string
  constructor() {
    this.id = null
    this.title = ''
  }
}
```

### Service

```typescript
import { http } from '@/lib/axios'
import type { Document } from '../model/document'

export class DocumentService {
  private endpoint = '/api/v1/documents'
  async list(params: DocumentFilter): Promise<Page<Document>> {
    const { data } = await http.get(`${this.endpoint}/filter`, { params })
    return data
  }
  async save(doc: Document): Promise<Document> {
    const { data } = doc.id
      ? await http.put(`${this.endpoint}/${doc.id}`, doc)
      : await http.post(this.endpoint, doc)
    return data
  }
}
```

### Store (Pinia — Setup API recomendado com shadcn-vue)

```typescript
import { defineStore } from 'pinia'
export const useDocumentStore = defineStore('document', () => {
  const page = ref<Page<Document> | null>(null)
  async function findByFilter(filter: DocumentFilter) {
    page.value = await new DocumentService().list(filter)
  }
  return { page, findByFilter }
})
```

Compatível com Options API se já em uso.

## Axios Config (`src/lib/axios.ts`)

- Instance `http` com `baseURL` via `VITE_API_URL` ou proxy `/api`
- Request interceptor: `Authorization: Bearer {token}` de `localStorage("accessToken")`
- Response interceptor: em 401, tenta refresh `/api/v1/auth/refresh`; falha → clear + redirect `/login`

## Router (`vue-router`)

- `createWebHistory`
- Guard `beforeEach`: sem token + rota protegida → `/login`
- Layouts: `layouts/default.vue` (autenticado, sidebar) e `layouts/blank.vue` (login/error)
- Lazy: `component: () => import('@/pages/documents/List.vue')`

## Vite Proxy (dev)

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

Frontend usa `/api/v1/{resource}` → backend ` /v1/{resource}` (sem rewrite `/taskflow` legado).

## Componentes (shadcn-vue)

- Gerar via CLI: `npx shadcn-vue add button card dialog input table badge`
- Usar componentes de `src/components/ui/*` (Button, Card, Dialog, Input, DataTable, etc.)
- Tailwind para layout; **não** usar `VBtn`, `VCard`, `VDataTable` (Vuetify proibido)
- `<script lang="ts" setup>` sempre; template PascalCase (`<Button>`, `<DocumentForm>`)
- Estado de loading/empty/error obrigatório em listas; `Skeleton` para loading

## Composables

- `src/composables/useLoader.ts` e `useToast.ts` (sonner / shadcn-vue toast)
- Erro: `toast.error(handlerError(error))`; sucesso: `toast.success("...")`

## Auto-imports (opcional)

- Se `unplugin-auto-import` ativo: `ref`, `computed`, `onMounted` auto-importados
- Caso contrário, imports explícitos

## Icons

- `lucide-vue-next` — ex: `<Search class="h-4 w-4" />`
- Não usar `@iconify-json/ri` / `mdi` no Atlas ECM

## Dependências Principais (Atlas ECM)

| Pacote | Uso |
|--------|-----|
| vue ^3.5 | Framework |
| shadcn-vue | UI (Radix + Tailwind) |
| tailwindcss | Estilo |
| pinia | Estado |
| vue-router ^4.5 | Roteamento |
| axios ^1.10 | HTTP |
| vue-i18n ^9 | i18n |
| zod + vee-validate | Forms/validação |
| lucide-vue-next | Ícones |
| @tanstack/vue-query | Cache server-state (opcional) |

## Build & Test

```bash
npm run dev           # Vite em :5173
npm run build         # vue-tsc --noEmit && vite build
npm run typecheck     # vue-tsc --noEmit
npm run lint          # eslint
npm run test:run      # vitest --run (happy-dom)
```

## Internationalization (MANDATORY)

Todo texto visível DEVE usar vue-i18n. Proibido literal em template/script/placeholder/aria-label/tooltip.

1. Infra: `app.use(i18n)` em `main.ts` (`src/i18n/index.ts`), `legacy: false`, `fallbackLocale: 'pt-BR'`
2. Arquivos: `src/i18n/messages/pt-BR.ts` (completo) e `en-US.ts`
3. Chaves: dot-nested + prefixo módulo, camelCase. Ex: `document.actions.upload`, `document.status.APPROVED`
4. Uso: `const { t } = useI18n()` no `<script setup>`; template via `t()`
5. Constantes `*_META`: guardar `labelKey`, resolver com `t(meta.labelKey)`
6. Default: PT-BR. Review flagra string fora de `<locale>.ts`
