# Spiderman Pet + Skin DSH Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two hot-pluggable DSH web plugins — a Spider-Man cartoon pet with sprite-sheet animation and interactions, and a red-blue Spider-Man skin with mouse-follow fluid effect plus Peter/suit identity reveal.

**Architecture:** pnpm workspace with two independent plugin bundles. `dsh-spider-pet` is a dual-face Cordis plugin (host half registers settings namespace + system-prompt section; browser half DOM-injects a bottom-right floating pet rendered from a sprite sheet). `dsh-skin-spiderman` is a pure browser-half plugin that applies a scoped theme via `body[data-dsh-spiderman]`, injects a lightweight canvas fluid layer, and an identity-reveal element. Core logic is framework-free TS (unit-testable), DOM/browser code is thin adapters.

**Tech Stack:** TypeScript, Cordis (`@deepseek-ai/cordis`), React 18 (pet UI), tsdown (bundle), vitest + jsdom (tests), pnpm workspace, official `@deepseek-ai/*` SDK devDependencies.

## Global Constraints

- Node >= 22, pnpm >= 10. Types resolve ONLY from `node_modules` `@deepseek-ai/*` SDK packages (`^0.1.0-rc.6`, cordis `^4.0.1`); never from a dsh source checkout.
- Plugin row id and package naming: `spider-pet` / `@deepseek-ai/dsh-spider-pet`; `ui-skin-spiderman` / `@deepseek-ai/dsh-client-ui-skin-spiderman`.
- No emoji anywhere (code, comments, docs, commit messages). Use plain chars (`x`, `*`, `-`).
- All registrations are reversible; every DOM write has a matching disposer; browser mount failures log and degrade, never throw.
- Skin CSS scoped under `body[data-dsh-spiderman]`; no bare global selectors.
- Build preset shared at `shared/tsdown.client.ts` (single copy, no per-package duplicates).
- Repo root already committed with design spec; reference assets live in `素材/spidey/`.
- API key for asset generation is supplied by the user at runtime via environment variable; never hardcode keys in files.

---

## File Structure

```text
deepseek-plugin/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── shared/
│   ├── tsdown.client.ts
│   └── web-platform.ts
├── packages/
│   ├── dsh-spider-pet/
│   │   ├── package.json
│   │   ├── cordis.patch.yml
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── tsdown.config.ts
│   │   ├── vitest.config.ts
│   │   ├── vitest.setup.ts
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── invariant.ts
│   │   │   ├── core/
│   │   │   │   ├── ledger.ts
│   │   │   │   ├── state.ts
│   │   │   │   ├── spritesheet.ts
│   │   │   │   └── controller.ts
│   │   │   └── client/
│   │   │       ├── index.ts
│   │   │       ├── mount.ts
│   │   │       ├── PetView.tsx
│   │   │       ├── PetPanel.tsx
│   │   │       ├── locales.ts
│   │   │       └── pet.module.css
│   │   └── tests/
│   │       ├── ledger.spec.ts
│   │       ├── state.spec.ts
│   │       ├── spritesheet.spec.ts
│   │       └── controller.spec.ts
│   └── dsh-skin-spiderman/
│       ├── package.json
│       ├── cordis.patch.yml
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── tsdown.config.ts
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── client/
│       │   │   ├── index.ts
│       │   │   ├── fluid.ts
│       │   │   ├── reveal.ts
│       │   │   └── spiderman.module.css
│       │   └── assets/
│       │       ├── peter.jpg
│       │       ├── suit.jpg
│       │       └── spider-mark.png
│       └── tests/
│           └── apply.spec.ts
├── scripts/
│   └── build-spritesheet.mjs
└── docs/superpowers/plans/2026-08-14-spiderman-plugin.md
```

---

### Task 1: Repo Scaffold (workspace + shared build preset)

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `shared/web-platform.ts`
- Create: `shared/tsdown.client.ts`
- Test: none (scaffold verified by `pnpm install` + `tsc --noEmit` in Task 18)

**Interfaces:**
- Produces: workspace scripts `build` / `typecheck`; `shared/tsdown.client.ts` exports `clientBundle(name, entries, options?)`; `shared/web-platform.ts` exports `PLATFORM_MODULES: readonly string[]`.

- [ ] **Step 1: Write root manifest files**

`package.json`:
```json
{
  "name": "dsh-plugins",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.19.0",
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "lightningcss": "^1.32.0",
    "typescript": "~5.7.2",
    "tsdown": "0.22.2"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": []
  }
}
```

- [ ] **Step 2: Create shared platform module table**

`shared/web-platform.ts` (kept minimal — these names are resolved by the loader module table at runtime):
```ts
export const PLATFORM_MODULES: readonly string[] = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-connection/client',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-conversation/client',
  '@deepseek-ai/cordis',
]
```

- [ ] **Step 3: Copy shared tsdown preset**

Copy `/Users/aadmin/tool/deepseek-plugin/资源/dsh-web-ui-main/shared/tsdown.client.ts` verbatim to `shared/tsdown.client.ts`. In the copy, change the constant `REPOSITORY_ROOT` so it points at this repo root:
```ts
const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url))
```
Verify the file exports `clientBundle` and `CLIENT_EXTERNALS`.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json shared/
git commit -m "chore: scaffold pnpm workspace and shared client bundle preset"
```

---

### Task 2: Pet Package Skeleton

**Files:**
- Create: `packages/dsh-spider-pet/package.json`
- Create: `packages/dsh-spider-pet/cordis.patch.yml`
- Create: `packages/dsh-spider-pet/tsconfig.json`
- Create: `packages/dsh-spider-pet/tsconfig.build.json`
- Create: `packages/dsh-spider-pet/tsdown.config.ts`
- Create: `packages/dsh-spider-pet/vitest.config.ts`
- Create: `packages/dsh-spider-pet/vitest.setup.ts`
- Create: `packages/dsh-spider-pet/src/index.ts`
- Create: `packages/dsh-spider-pet/src/invariant.ts`
- Create: `packages/dsh-spider-pet/src/client/index.ts`
- Test: none (compile check)

**Interfaces:**
- Produces: package `@deepseek-ai/dsh-spider-pet` with exports `.`, `./client`, `./src/*`; dual-face `dsh.client` declaration; host `apply(ctx)`; browser `apply(ctx: ClientContext)`.

- [ ] **Step 1: Write package manifest**

`packages/dsh-spider-pet/package.json`:
```json
{
  "name": "@deepseek-ai/dsh-spider-pet",
  "description": "Spider-Man cartoon pet for the dsh web GUI: sprite-sheet animation, petting/feeding interactions and affinity, hot-pluggable via a profile bundle",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./invariant": { "types": "./lib/types/invariant.d.ts", "default": "./lib/invariant.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-connection", "@deepseek-ai/dsh-client-ui-settings"], "platform": "web" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json && tsdown",
    "prepare": "tsdown",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@deepseek-ai/dsh-client-connection": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-client-runtime": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-client-ui-settings": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-settings": "^0.1.0-rc.6",
    "react": "^18.2.0"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "^4.0.1",
    "@deepseek-ai/dsh-client-connection": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-client-locale": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-client-runtime": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-client-ui-settings": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-client-ui-slots": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-settings": "^0.1.0-rc.6",
    "@deepseek-ai/dsh-system-prompt": "^0.1.0-rc.6",
    "@types/react": "~18.3.1",
    "@types/react-dom": "^18.3.5",
    "jsdom": "^25.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "schemastery": "^3.18.0",
    "tsdown": "0.22.2",
    "typescript": "~5.7.2",
    "vite-tsconfig-paths": "^6.1.1",
    "vitest": "^4.1.8"
  },
  "files": ["lib", "cordis.patch.yml", "README.md", "assets"],
  "license": "BSD-3-Clause"
}
```

`packages/dsh-spider-pet/cordis.patch.yml`:
```yaml
- insert:
    - id: spider-pet
      name: '@deepseek-ai/dsh-spider-pet'
```

- [ ] **Step 2: Write compiler configs**

`tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"]
}
```

`tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "declaration": true,
    "emitDeclarationOnly": true,
    "rootDir": "src",
    "outDir": "lib/types"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

`tsdown.config.ts`:
```ts
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@deepseek-ai/dsh-spider-pet', ['src/index.ts'])
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    server: { deps: { inline: [/@deepseek-ai\//] } },
  },
})
```

`vitest.setup.ts`:
```ts
// Minimal ModuleLoader stub for the client-half closure-factory shape.
declare global {
  interface Window {
    __ModuleLoader__?: { load(id: string, factory: () => unknown): void }
  }
}

if (typeof window !== 'undefined' && !window.__ModuleLoader__) {
  window.__ModuleLoader__ = { load: () => undefined }
}

export {}
```

- [ ] **Step 3: Write minimal dual-face entries**

`src/index.ts`:
```ts
import type { Context } from '@deepseek-ai/cordis'

export const inject = ['systemPrompt']

export interface Config {
  enabled?: boolean
  announceToAgent?: boolean
}

export function apply(ctx: Context): void {
  // Host behavior lands in Task 7. Skeleton keeps the module loadable.
  void ctx
}
```

`src/invariant.ts`:
```ts
export function apply(): void {}
```

`src/client/index.ts`:
```ts
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

export const inject = ['slots', 'locale', 'connection', 'settingsScope']

export function apply(ctx: ClientContext): void {
  // Browser behavior lands in Tasks 8-10. Skeleton keeps the module loadable.
  void ctx
}
```

- [ ] **Step 4: Install workspace deps and typecheck**

```bash
pnpm install
pnpm --filter @deepseek-ai/dsh-spider-pet typecheck
```
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/dsh-spider-pet
git commit -m "feat: scaffold spider-pet dual-face plugin package"
```

---

### Task 3: Affinity Ledger (framework-free core)

**Files:**
- Create: `packages/dsh-spider-pet/src/core/ledger.ts`
- Test: `packages/dsh-spider-pet/tests/ledger.spec.ts`

**Interfaces:**
- Produces:
  - `type PetInteraction = 'pet' | 'feed'`
  - `interface AffinityState { points: number; pets: number; feeds: number; lastPetAt: number; lastFeedAt: number }`
  - `interface LedgerConfig { petPoints: number; feedPoints: number; petCooldownMs: number; feedCooldownMs: number; maxPoints: number }`
  - `const defaultLedgerConfig: LedgerConfig`
  - `const PET_RANKS: readonly { min: number; name: string }[]` (names: 幼蛛 / 伙伴 / 挚友 / 羁绊)
  - `function rankOf(points: number): string`
  - `function applyInteraction(state: AffinityState, kind: PetInteraction, now: number, config?: Partial<LedgerConfig>): { state: AffinityState; granted: boolean; reason?: string }`

- [ ] **Step 1: Write the failing test**

`tests/ledger.spec.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { applyInteraction, rankOf, type AffinityState } from '../src/core/ledger.ts'

const base: AffinityState = { points: 0, pets: 0, feeds: 0, lastPetAt: 0, lastFeedAt: 0 }

describe('applyInteraction', () => {
  it('grants pet points on first pet', () => {
    const r = applyInteraction(base, 'pet', 0)
    expect(r.granted).toBe(true)
    expect(r.state.points).toBe(1)
    expect(r.state.pets).toBe(1)
    expect(r.state.lastPetAt).toBe(0)
  })

  it('rejects pet during cooldown', () => {
    const r1 = applyInteraction(base, 'pet', 0)
    const r2 = applyInteraction(r1.state, 'pet', 0 + 5000)
    expect(r2.granted).toBe(false)
    expect(r2.reason).toMatch(/冷却/)
    expect(r2.state.points).toBe(1)
  })

  it('grants feed points and resets feed cooldown', () => {
    const r = applyInteraction(base, 'feed', 0)
    expect(r.granted).toBe(true)
    expect(r.state.points).toBe(5)
    expect(r.state.feeds).toBe(1)
    expect(r.state.lastFeedAt).toBe(0)
  })

  it('caps points at maxPoints', () => {
    const r = applyInteraction({ ...base, points: 98 }, 'feed', 30_000)
    expect(r.state.points).toBe(100)
  })
})

describe('rankOf', () => {
  it('returns rank names by threshold', () => {
    expect(rankOf(0)).toBe('幼蛛')
    expect(rankOf(30)).toBe('伙伴')
    expect(rankOf(60)).toBe('挚友')
    expect(rankOf(100)).toBe('羁绊')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet test -- ledger`
Expected: FAIL with "Cannot find module ... ledger.ts"

- [ ] **Step 3: Write minimal implementation**

`src/core/ledger.ts`:
```ts
export type PetInteraction = 'pet' | 'feed'

export interface AffinityState {
  points: number
  pets: number
  feeds: number
  lastPetAt: number
  lastFeedAt: number
}

export interface LedgerConfig {
  petPoints: number
  feedPoints: number
  petCooldownMs: number
  feedCooldownMs: number
  maxPoints: number
}

export const defaultLedgerConfig: LedgerConfig = {
  petPoints: 1,
  feedPoints: 5,
  petCooldownMs: 10_000,
  feedCooldownMs: 30_000,
  maxPoints: 100,
}

export const PET_RANKS = [
  { min: 0, name: '幼蛛' },
  { min: 30, name: '伙伴' },
  { min: 60, name: '挚友' },
  { min: 100, name: '羁绊' },
] as const

export function rankOf(points: number): string {
  let name = PET_RANKS[0].name
  for (const rank of PET_RANKS) {
    if (points >= rank.min) name = rank.name
  }
  return name
}

export function applyInteraction(
  state: AffinityState,
  kind: PetInteraction,
  now: number,
  config: Partial<LedgerConfig> = {},
): { state: AffinityState; granted: boolean; reason?: string } {
  const cfg = { ...defaultLedgerConfig, ...config }
  const last = kind === 'pet' ? state.lastPetAt : state.lastFeedAt
  const cooldown = kind === 'pet' ? cfg.petCooldownMs : cfg.feedCooldownMs
  if (now - last < cooldown) {
    return { state, granted: false, reason: '冷却中，等一会儿再来' }
  }
  const gain = kind === 'pet' ? cfg.petPoints : cfg.feedPoints
  const next: AffinityState = {
    ...state,
    points: Math.min(cfg.maxPoints, state.points + gain),
    pets: state.pets + (kind === 'pet' ? 1 : 0),
    feeds: state.feeds + (kind === 'feed' ? 1 : 0),
    lastPetAt: kind === 'pet' ? now : state.lastPetAt,
    lastFeedAt: kind === 'feed' ? now : state.lastFeedAt,
  }
  return { state: next, granted: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet test -- ledger`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/dsh-spider-pet/src/core/ledger.ts packages/dsh-spider-pet/tests/ledger.spec.ts
git commit -m "feat: add pet affinity ledger with cooldowns and ranks"
```

---

### Task 4: Animation State Machine

**Files:**
- Create: `packages/dsh-spider-pet/src/core/state.ts`
- Test: `packages/dsh-spider-pet/tests/state.spec.ts`

**Interfaces:**
- Produces:
  - `type PetActivity = 'idle' | 'waiting' | 'thinking' | 'done' | 'failed'`
  - `type PetAnimation = 'idle' | 'waiting' | 'thinking' | 'jumping' | 'pet' | 'failed'`
  - `function animationFor(activity: PetActivity | undefined, petTriggered: boolean): PetAnimation`

- [ ] **Step 1: Write the failing test**

`tests/state.spec.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { animationFor } from '../src/core/state.ts'

describe('animationFor', () => {
  it('maps activities to animations', () => {
    expect(animationFor('idle', false)).toBe('idle')
    expect(animationFor('waiting', false)).toBe('waiting')
    expect(animationFor('thinking', false)).toBe('thinking')
    expect(animationFor('done', false)).toBe('jumping')
    expect(animationFor('failed', false)).toBe('failed')
  })

  it('pet animation takes priority over idle', () => {
    expect(animationFor('idle', true)).toBe('pet')
    expect(animationFor(undefined, true)).toBe('pet')
  })

  it('defaults to idle', () => {
    expect(animationFor(undefined, false)).toBe('idle')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet test -- state`
Expected: FAIL, module not found.

- [ ] **Step 3: Write minimal implementation**

`src/core/state.ts`:
```ts
export type PetActivity = 'idle' | 'waiting' | 'thinking' | 'done' | 'failed'
export type PetAnimation = 'idle' | 'waiting' | 'thinking' | 'jumping' | 'pet' | 'failed'

const MAP: Record<PetActivity, PetAnimation> = {
  idle: 'idle',
  waiting: 'waiting',
  thinking: 'thinking',
  done: 'jumping',
  failed: 'failed',
}

export function animationFor(activity: PetActivity | undefined, petTriggered: boolean): PetAnimation {
  if (petTriggered) return 'pet'
  return activity === undefined ? 'idle' : MAP[activity]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet test -- state`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dsh-spider-pet/src/core/state.ts packages/dsh-spider-pet/tests/state.spec.ts
git commit -m "feat: add pet animation state machine"
```

---

### Task 5: Sprite Sheet Frame Table

**Files:**
- Create: `packages/dsh-spider-pet/src/core/spritesheet.ts`
- Test: `packages/dsh-spider-pet/tests/spritesheet.spec.ts`

**Interfaces:**
- Produces:
  - `interface SpriteSheetMeta { framesPerRow: number; cellWidth: number; cellHeight: number }`
  - `interface FrameTable { rows: Record<string, number>; frames: number[] }` (row index per animation; frame count per row)
  - `function framePosition(meta: SpriteSheetMeta, row: number, index: number): { x: number; y: number }`
  - `function totalFrames(table: FrameTable): number`

- [ ] **Step 1: Write the failing test**

`tests/spritesheet.spec.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { framePosition, totalFrames } from '../src/core/spritesheet.ts'

describe('framePosition', () => {
  const meta = { framesPerRow: 8, cellWidth: 256, cellHeight: 256 }

  it('computes pixel offsets for a frame', () => {
    expect(framePosition(meta, 2, 3)).toEqual({ x: 3 * 256, y: 2 * 256 })
    expect(framePosition(meta, 0, 7)).toEqual({ x: 7 * 256, y: 0 })
  })
})

describe('totalFrames', () => {
  it('sums frame counts', () => {
    expect(totalFrames({ rows: { idle: 0, jumping: 1 }, frames: [6, 4] })).toBe(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet test -- spritesheet`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`src/core/spritesheet.ts`:
```ts
export interface SpriteSheetMeta {
  framesPerRow: number
  cellWidth: number
  cellHeight: number
}

export interface FrameTable {
  rows: Record<string, number>
  frames: number[]
}

export function framePosition(
  meta: SpriteSheetMeta,
  row: number,
  index: number,
): { x: number; y: number } {
  return { x: index * meta.cellWidth, y: row * meta.cellHeight }
}

export function totalFrames(table: FrameTable): number {
  return table.frames.reduce((sum, count) => sum + count, 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet test -- spritesheet`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dsh-spider-pet/src/core/spritesheet.ts packages/dsh-spider-pet/tests/spritesheet.spec.ts
git commit -m "feat: add sprite sheet frame table helpers"
```

---

### Task 6: Pet Controller

**Files:**
- Create: `packages/dsh-spider-pet/src/core/controller.ts`
- Test: `packages/dsh-spider-pet/tests/controller.spec.ts`

**Interfaces:**
- Produces:
  - `interface PetPersist { affinity: AffinityState; display: { visible: boolean; size: number; right: number; bottom: number; name: string } }`
  - `const PET_STORAGE_KEY = 'dsh.spiderPet.v1'`
  - `function loadPersist(storage: Pick<Storage, 'getItem'>, fallback: PetPersist): PetPersist`
  - `function savePersist(storage: Pick<Storage, 'setItem'>, persist: PetPersist): void`
  - `class PetController` with:
    - `constructor(deps: { storage: Pick<Storage, 'getItem' | 'setItem'>; now?: () => number })`
    - `getSnapshot(): { persist: PetPersist; activity: PetActivity; petTriggered: boolean; animation: PetAnimation }`
    - `subscribe(fn: () => void): () => void`
    - `setActivity(activity: PetActivity): void`
    - `interact(kind: PetInteraction): { granted: boolean; reason?: string }`
    - `setDisplay(patch: Partial<PetPersist['display']>): void`
    - `rename(name: string): { ok: boolean; error?: string }`

- [ ] **Step 1: Write the failing test**

`tests/controller.spec.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { PetController, loadPersist, type PetPersist } from '../src/core/controller.ts'

const fallback: PetPersist = {
  affinity: { points: 0, pets: 0, feeds: 0, lastPetAt: 0, lastFeedAt: 0 },
  display: { visible: true, size: 160, right: 24, bottom: 20, name: '蛛蛛侠' },
}

function memoryStorage(initial?: string): Storage {
  let value = initial ?? null
  return {
    getItem: () => value,
    setItem: (_k, v) => { value = v },
    removeItem: () => { value = null },
    clear: () => { value = null },
    key: () => null,
    length: 0,
  }
}

describe('loadPersist', () => {
  it('falls back to defaults on empty storage', () => {
    const p = loadPersist(memoryStorage(), fallback)
    expect(p.display.name).toBe('蛛蛛侠')
  })

  it('parses stored JSON', () => {
    const s = memoryStorage(JSON.stringify({ ...fallback, display: { ...fallback.display, name: '小蛛' } }))
    expect(loadPersist(s, fallback).display.name).toBe('小蛛')
  })
})

describe('PetController', () => {
  it('persists and notifies on interaction', () => {
    let now = 0
    const controller = new PetController({ storage: memoryStorage(), now: () => now })
    const events: string[] = []
    controller.subscribe(() => events.push('change'))
    const r = controller.interact('pet')
    expect(r.granted).toBe(true)
    expect(controller.getSnapshot().persist.affinity.points).toBe(1)
    expect(events).toContain('change')
  })

  it('renames within length bounds', () => {
    const controller = new PetController({ storage: memoryStorage(), now: () => 0 })
    expect(controller.rename('小蛛').ok).toBe(true)
    expect(controller.getSnapshot().persist.display.name).toBe('小蛛')
    expect(controller.rename('').ok).toBe(false)
    expect(controller.rename('x'.repeat(21)).ok).toBe(false)
  })

  it('maps activity to animation and clears pet trigger after snapshot', () => {
    const controller = new PetController({ storage: memoryStorage(), now: () => 0 })
    controller.interact('pet')
    controller.setActivity('idle')
    expect(controller.getSnapshot().animation).toBe('pet')
    expect(controller.getSnapshot().animation).toBe('idle')
    controller.setActivity('done')
    expect(controller.getSnapshot().animation).toBe('jumping')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet test -- controller`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`src/core/controller.ts`:
```ts
import {
  applyInteraction,
  type AffinityState,
  type PetInteraction,
} from './ledger.ts'
import {
  animationFor,
  type PetActivity,
  type PetAnimation,
} from './state.ts'

export interface PetPersist {
  affinity: AffinityState
  display: {
    visible: boolean
    size: number
    right: number
    bottom: number
    name: string
  }
}

export const PET_STORAGE_KEY = 'dsh.spiderPet.v1'

const PET_NAME_MAX = 20

export const defaultPersist: PetPersist = {
  affinity: { points: 0, pets: 0, feeds: 0, lastPetAt: 0, lastFeedAt: 0 },
  display: { visible: true, size: 160, right: 24, bottom: 20, name: '蛛蛛侠' },
}

export function loadPersist(
  storage: Pick<Storage, 'getItem'>,
  fallback: PetPersist,
): PetPersist {
  try {
    const raw = storage.getItem(PET_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PetPersist>
    return {
      affinity: { ...fallback.affinity, ...parsed.affinity },
      display: { ...fallback.display, ...parsed.display },
    }
  } catch {
    return fallback
  }
}

export function savePersist(
  storage: Pick<Storage, 'setItem'>,
  persist: PetPersist,
): void {
  try {
    storage.setItem(PET_STORAGE_KEY, JSON.stringify(persist))
  } catch {
    // Storage unavailable (private mode): degrade silently.
  }
}

export interface PetControllerDeps {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  now?: () => number
}

export class PetController {
  private persist: PetPersist
  private activity: PetActivity = 'idle'
  private petTriggered = false
  private listeners = new Set<() => void>()
  private readonly now: () => number

  constructor(private readonly deps: PetControllerDeps) {
    this.now = deps.now ?? (() => Date.now())
    this.persist = loadPersist(deps.storage, defaultPersist)
  }

  getSnapshot(): {
    persist: PetPersist
    activity: PetActivity
    petTriggered: boolean
    animation: PetAnimation
  } {
    const animation = animationFor(this.activity, this.petTriggered)
    this.petTriggered = false
    return { persist: this.persist, activity: this.activity, petTriggered: animation === 'pet', animation }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  setActivity(activity: PetActivity): void {
    if (this.activity === activity) return
    this.activity = activity
    this.notify()
  }

  interact(kind: PetInteraction): { granted: boolean; reason?: string } {
    const result = applyInteraction(this.persist.affinity, kind, this.now())
    if (!result.granted) return result
    this.persist = { ...this.persist, affinity: result.state }
    if (kind === 'pet') this.petTriggered = true
    this.persistAndNotify()
    return { granted: true }
  }

  setDisplay(patch: Partial<PetPersist['display']>): void {
    this.persist = { ...this.persist, display: { ...this.persist.display, ...patch } }
    this.persistAndNotify()
  }

  rename(name: string): { ok: boolean; error?: string } {
    const trimmed = name.trim()
    if (trimmed === '') return { ok: false, error: '名字不能为空' }
    if (trimmed.length > PET_NAME_MAX) return { ok: false, error: '名字太长' }
    this.setDisplay({ name: trimmed })
    return { ok: true }
  }

  private persistAndNotify(): void {
    savePersist(this.deps.storage, this.persist)
    this.notify()
  }

  private notify(): void {
    for (const fn of [...this.listeners]) fn()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet test -- controller`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dsh-spider-pet/src/core/controller.ts packages/dsh-spider-pet/tests/controller.spec.ts
git commit -m "feat: add pet controller with persistence and interaction"
```

---

### Task 7: Pet Host Half (settings namespace + system prompt)

**Files:**
- Modify: `packages/dsh-spider-pet/src/index.ts`

**Interfaces:**
- Consumes: `installSettingsSection`, `settingsNamespace` from `@deepseek-ai/dsh-settings`; `z` from `schemastery`; `Context` from `@deepseek-ai/cordis`.
- Produces: settings namespace `spider-pet` with schema `{ enabled, visible, size, right, bottom, name, announceToAgent }`; system-prompt section `plugin:spider-pet` (order 200) announcing pet capabilities; both gated by config and live settings.

- [ ] **Step 1: Write implementation**

Replace `src/index.ts` with:
```ts
import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import type {} from '@deepseek-ai/dsh-system-prompt'

export const inject = ['systemPrompt']

export const SPIDER_PET_SETTINGS_NAMESPACE = settingsNamespace('spider-pet')

export interface Config {
  enabled?: boolean
  visible?: boolean
  size?: number
  right?: number
  bottom?: number
  name?: string
  announceToAgent?: boolean
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  visible: z.boolean().default(true),
  size: z.number().min(80).max(320).default(160),
  right: z.number().min(0).max(800).default(24),
  bottom: z.number().min(0).max(800).default(20),
  name: z.string().default('蛛蛛侠'),
  announceToAgent: z.boolean().default(true),
})

const GUIDANCE = '本机已安装 dsh-spider-pet 插件：右下角有一只蜘蛛侠卡通宠物，可点击摸头、喂食、改名；用户提到「宠物/蜘蛛侠/蛛蛛侠」时即指本插件。'

export function apply(ctx: Context, config: Config = {}): void {
  let current: () => Config = () => config ?? {}
  let disposeSection: (() => void) | undefined

  const sync = (): void => {
    if (disposeSection !== undefined) {
      disposeSection()
      disposeSection = undefined
    }
    if ((current().enabled ?? true) === false) return
    if ((current().announceToAgent ?? true) === false) return
    disposeSection = ctx.systemPrompt.section({
      name: 'plugin:spider-pet',
      order: 200,
      text: GUIDANCE,
    })
  }

  installSettingsSection(ctx, SPIDER_PET_SETTINGS_NAMESPACE, Config, config ?? {}, {
    setSource: (source) => { current = source },
    onChange: sync,
  })
  sync()
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/dsh-spider-pet/src/index.ts
git commit -m "feat: register spider-pet settings namespace and system prompt section"
```

---

### Task 8: Pet Browser Mount + Animated View

**Files:**
- Create: `packages/dsh-spider-pet/src/client/pet.module.css`
- Create: `packages/dsh-spider-pet/src/client/PetView.tsx`
- Create: `packages/dsh-spider-pet/src/client/mount.ts`
- Modify: `packages/dsh-spider-pet/src/client/index.ts`
- Test: none (browser smoke in Task 18)

**Interfaces:**
- Consumes: `PetController`, `SpriteSheetMeta`, `FrameTable`, `PetAnimation` from `../core/*`.
- Produces:
  - `const PET_VIEW_SELECTOR = '[data-dsh-spider-pet]'`
  - `function mountPet(controller: PetController, meta: SpriteSheetMeta, table: FrameTable, sheetUrl: string): () => void`
  - Browser entry calls `mountPet` when settings enable it, retracting on dispose.

- [ ] **Step 1: Write the stylesheet**

`src/client/pet.module.css`:
```css
.petView {
  position: fixed;
  z-index: 2147483000;
  width: 160px;
  height: 160px;
  pointer-events: auto;
  user-select: none;
  cursor: grab;
}
.petView[data-dragging='true'] { cursor: grabbing; }
.petSprite {
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  animation-timing-function: steps(1, end);
}
.bubble {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 24, 33, 0.92);
  color: #fff;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}
.bubble[data-show='true'] { opacity: 1; }
```

- [ ] **Step 2: Write the animated view component**

`src/client/PetView.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import type { PetController, PetPersist } from '../core/controller.ts'
import type { FrameTable, SpriteSheetMeta } from '../core/spritesheet.ts'
import type { PetAnimation } from '../core/state.ts'
import { framePosition, totalFrames } from '../core/spritesheet.ts'
import css from './pet.module.css'

export interface PetViewProps {
  controller: PetController
  meta: SpriteSheetMeta
  table: FrameTable
  sheetUrl: string
  onInteract: () => void
}

export function PetView(props: PetViewProps): JSX.Element {
  const [frame, setFrame] = useState(0)
  const frameRef = useRef(0)
  const [showBubble, setShowBubble] = useState(false)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const timer = setInterval(() => {
      const total = totalFrames(props.table)
      frameRef.current = (frameRef.current + 1) % total
      setFrame(frameRef.current)
    }, 120)
    return () => clearInterval(timer)
  }, [props.table])

  const snapshot = props.controller.getSnapshot()
  const persist: PetPersist = snapshot.persist
  const animation: PetAnimation = snapshot.animation
  const row = props.table.rows[animation] ?? props.table.rows.idle ?? 0
  const index = frame % (props.table.frames[row] ?? 1)
  const pos = framePosition(props.meta, row, index)

  const handleClick = (): void => {
    props.onInteract()
    setShowBubble(true)
    if (bubbleTimer.current !== undefined) clearTimeout(bubbleTimer.current)
    bubbleTimer.current = setTimeout(() => setShowBubble(false), 1200)
  }

  return (
    <div
      className={css.petView}
      data-dsh-spider-pet=""
      style={{ right: persist.display.right, bottom: persist.display.bottom, width: persist.display.size, height: persist.display.size }}
      onClick={handleClick}
      role="button"
      aria-label={persist.display.name}
    >
      <span className={css.bubble} data-show={showBubble}>{persist.display.name}</span>
      <div
        className={css.petSprite}
        style={{
          backgroundImage: `url(${props.sheetUrl})`,
          backgroundSize: `${props.meta.framesPerRow * props.meta.cellWidth}px ${props.meta.cellHeight}px`,
          backgroundPosition: `-${pos.x}px -${pos.y}px`,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Write the DOM mount helper**

`src/client/mount.ts`:
```ts
import { createRoot, type Root } from 'react-dom/client'
import type { PetController } from '../core/controller.ts'
import type { FrameTable, SpriteSheetMeta } from '../core/spritesheet.ts'
import { PetView } from './PetView.tsx'

export const PET_VIEW_SELECTOR = '[data-dsh-spider-pet]'

export function mountPet(
  controller: PetController,
  meta: SpriteSheetMeta,
  table: FrameTable,
  sheetUrl: string,
): () => void {
  const container = document.createElement('div')
  container.dataset.dshSpiderPetRoot = ''
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  const render = (): void => {
    root.render(
      <PetView
        controller={controller}
        meta={meta}
        table={table}
        sheetUrl={sheetUrl}
        onInteract={() => { controller.interact('pet') }}
      />,
    )
  }
  const unsubscribe = controller.subscribe(render)
  render()

  return () => {
    unsubscribe()
    root.unmount()
    container.remove()
  }
}
```

- [ ] **Step 4: Wire the browser entry**

Replace `src/client/index.ts` body with:
```ts
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { PetController } from '../core/controller.ts'
import { SPRITE_SHEET_URL } from '../assets/spritesheet.ts'
import { mountPet } from './mount.ts'

export const inject = ['slots', 'locale', 'settingsScope']

export const SPRITE_META = { framesPerRow: 8, cellWidth: 256, cellHeight: 256 } as const

export const FRAME_TABLE = {
  rows: { idle: 0, waiting: 1, thinking: 2, jumping: 3, pet: 4, failed: 5 },
  frames: [6, 6, 6, 5, 4, 4],
} as const

export function apply(ctx: ClientContext): void {
  const storage = typeof localStorage !== 'undefined' ? localStorage : undefined
  if (storage === undefined) return
  const controller = new PetController({ storage })

  let disposer: (() => void) | undefined
  const syncEnabled = (): void => {
    const scope = ctx.settingsScope.getSnapshot()
    const enabled = scope.status === 'ready' ? (scope.value?.enabled ?? true) : true
    if (enabled) {
      if (disposer !== undefined) return
      try {
        disposer = mountPet(controller, SPRITE_META, FRAME_TABLE, SPRITE_SHEET_URL)
      } catch (error) {
        console.error('[dsh-spider-pet] mount failed:', error)
      }
    } else {
      disposer?.()
      disposer = undefined
    }
  }
  ctx.settingsScope.subscribe(syncEnabled)
  syncEnabled()
}
```

Note: `settingsScope` requires the `dsh-client-ui-settings` package at runtime; if the settings surface is absent, the client module table still provides the injectable service (settingsScope may be unavailable and `getSnapshot()` returns `unavailable`, which this code treats as enabled).

Also create `src/assets/spritesheet.ts` as a placeholder that Task 16 replaces with the generated data URL:
```ts
/** Real data URL is generated by scripts/build-spritesheet.mjs (Task 16). */
export const SPRITE_SHEET_URL = 'data:image/webp;base64,'
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet typecheck`
Expected: exit 0. If `ctx.settingsScope` type is missing, add a `declare module '@deepseek-ai/dsh-client-ui-settings/client'` type-only import at the top (already present) and ensure `@deepseek-ai/dsh-client-ui-settings` is in devDependencies.

- [ ] **Step 6: Commit**

```bash
git add packages/dsh-spider-pet/src/client
git commit -m "feat: mount animated pet view in browser half"
```

---

### Task 9: Pet Interaction UI (panel, drag, feed, hide)

**Files:**
- Create: `packages/dsh-spider-pet/src/client/PetPanel.tsx`
- Modify: `packages/dsh-spider-pet/src/client/PetView.tsx` (add drag + panel toggle hook)
- Modify: `packages/dsh-spider-pet/src/client/mount.ts` (pass panel props)
- Modify: `packages/dsh-spider-pet/src/client/pet.module.css` (panel styles)

**Interfaces:**
- Consumes: `PetController.setDisplay`, `PetController.rename`, `PetController.interact`.
- Produces: `PetPanel({ controller, onClose })` React component; drag handling in `mountPet` updates `right`/`bottom`.

- [ ] **Step 1: Write panel component**

`src/client/PetPanel.tsx`:
```tsx
import { useState } from 'react'
import type { PetController } from '../core/controller.ts'
import { rankOf } from '../core/ledger.ts'
import css from './pet.module.css'

export interface PetPanelProps {
  controller: PetController
  onClose: () => void
}

export function PetPanel(props: PetPanelProps): JSX.Element {
  const [name, setName] = useState('')
  const snapshot = props.controller.getSnapshot()
  const { persist } = snapshot

  return (
    <div className={css.panel} data-dsh-spider-pet-panel="">
      <div className={css.panelHeader}>
        <b>{persist.display.name}</b>
        <span>{rankOf(persist.affinity.points)}</span>
        <button type="button" onClick={props.onClose}>x</button>
      </div>
      <div className={css.panelRow}>
        <span>亲密度 {persist.affinity.points}/100</span>
        <button type="button" onClick={() => { props.controller.interact('feed'); props.onClose() }}>喂食</button>
      </div>
      <div className={css.panelRow}>
        <input
          value={name}
          placeholder="新名字"
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          onClick={() => { props.controller.rename(name); setName(''); props.onClose() }}
        >
          改名
        </button>
      </div>
      <div className={css.panelRow}>
        <button type="button" onClick={() => { props.controller.setDisplay({ visible: false }); props.onClose() }}>隐藏</button>
        <button type="button" onClick={() => { props.controller.setDisplay({ size: Math.max(80, persist.display.size - 20) }); props.onClose() }}>-</button>
        <button type="button" onClick={() => { props.controller.setDisplay({ size: Math.min(320, persist.display.size + 20) }); props.onClose() }}>+</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add panel + drag to PetView**

Update `PetView.tsx`: add `showPanel` state, a right-click handler (or long-press via `onContextMenu`) to open the panel, and render `<PetPanel>` when open. Update `mount.ts` to implement pointer drag:

`src/client/mount.ts` (full replacement of drag wiring inside `mountPet`):
```ts
  let panelOpen = false
  const togglePanel = (): void => { panelOpen = !panelOpen }

  const render = (): void => {
    root.render(
      <PetView
        controller={controller}
        meta={meta}
        table={table}
        sheetUrl={sheetUrl}
        onInteract={() => { controller.interact('pet') }}
        onPanel={togglePanel}
        panelOpen={panelOpen}
      />,
    )
  }

  const onDrag = (event: PointerEvent): void => {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const base = controller.getSnapshot().persist.display
    const move = (ev: PointerEvent): void => {
      controller.setDisplay({
        right: Math.max(0, base.right - (ev.clientX - startX)),
        bottom: Math.max(0, base.bottom - (ev.clientY - startY)),
      })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  // Attach onDrag to the pet element in PetView via pointerdown on the sprite.
  // Pass an onDrag prop through PetViewProps and bind it to the container.
```

Update `PetViewProps` to add `onPanel: () => void; panelOpen: boolean; onDrag: (e: React.PointerEvent) => void` and bind `onPointerDown={props.onDrag}` on the container, `onContextMenu={(e) => { e.preventDefault(); props.onPanel() }}`.

Update `pet.module.css` with `.panel` block styles (absolute above pet, dark card, row layout).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/dsh-spider-pet/src/client
git commit -m "feat: add pet panel, feed, rename, hide and drag interactions"
```

---

### Task 10: Pet Settings Card

**Files:**
- Create: `packages/dsh-spider-pet/src/client/PluginSettingsCard.tsx`
- Modify: `packages/dsh-spider-pet/src/client/index.ts`

**Interfaces:**
- Consumes: `ctx.slots.inject('web-ui.plugin.item', ...)` + `ctx.slots.register(...)`; `ctx.settingsScope.bind({ namespace: 'spider-pet' })`.
- Produces: settings card component registered with id `spider-pet`, order 140, showing enabled/visible/name/size controls bound to the namespace.

- [ ] **Step 1: Write card component**

`src/client/PluginSettingsCard.tsx`:
```tsx
import type { PetController } from '../core/controller.ts'

export interface PluginSettingsCardProps {
  controller: PetController
}

export function PluginSettingsCard(_props: PluginSettingsCardProps): JSX.Element {
  // Minimal card: renders the current name and toggles visibility.
  const snapshot = _props.controller.getSnapshot()
  return (
    <div data-dsh-spider-pet-settings="">
      <div>宠物：{snapshot.persist.display.name}</div>
      <button type="button" onClick={() => _props.controller.setDisplay({ visible: !snapshot.persist.display.visible })}>
        {snapshot.persist.display.visible ? '隐藏' : '显示'}
      </button>
    </div>
  )
}
```

In `src/client/index.ts`, add a `declare module '@deepseek-ai/dsh-client-ui-slots'` block (as in dsh-web-ui packages) declaring the `'web-ui.plugin.item'` slot with `SettingsPluginItemOwnerProps`, then register the card:
```ts
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
  interface SettingsPluginItemOwnerProps { children?: never }
}

ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
  name: 'web-ui.plugin.item',
  id: 'spider-pet',
  order: 140,
  locale: 'spider-pet',
  inject: () => ({ controller }),
}, PluginSettingsCard))
```

Note: `locale` requires registering a namespace via `ctx.locale.register`; provide a minimal `locales.ts` exporting `{ zh: {...}, en: {...} }` with a `spider-pet` key and call `ctx.effect(() => ctx.locale.register('spider-pet', { zh, en }), 'spider-pet: dictionaries')`.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @deepseek-ai/dsh-spider-pet typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/dsh-spider-pet/src/client
git commit -m "feat: register spider-pet plugin settings card"
```

---

### Task 11: Skin Package Skeleton

**Files:**
- Create: `packages/dsh-skin-spiderman/package.json`
- Create: `packages/dsh-skin-spiderman/cordis.patch.yml`
- Create: `packages/dsh-skin-spiderman/tsconfig.json`
- Create: `packages/dsh-skin-spiderman/tsconfig.build.json`
- Create: `packages/dsh-skin-spiderman/tsdown.config.ts`
- Create: `packages/dsh-skin-spiderman/vitest.config.ts`
- Create: `packages/dsh-skin-spiderman/src/client/index.ts`

**Interfaces:**
- Produces: package `@deepseek-ai/dsh-client-ui-skin-spiderman`, browser-only (`dsh.client.inject: []`), plugin row `ui-skin-spiderman`, `apply(ctx)` setting `body[data-dsh-spiderman]`.

- [ ] **Step 1: Write manifest**

`packages/dsh-skin-spiderman/package.json`:
```json
{
  "name": "@deepseek-ai/dsh-client-ui-skin-spiderman",
  "description": "Spider-Man red-blue skin for the dsh web GUI: scoped theme, mouse-follow fluid canvas and Peter/suit identity reveal",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./invariant": { "types": "./lib/types/invariant.d.ts", "default": "./lib/invariant.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "inject": [], "platform": "web" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json && tsdown",
    "prepare": "tsdown",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "^4.0.1",
    "@types/react": "~18.3.1",
    "jsdom": "^25.0.0",
    "tsdown": "0.22.2",
    "typescript": "~5.7.2",
    "vitest": "^4.1.8"
  },
  "files": ["lib", "cordis.patch.yml", "README.md", "src/assets"],
  "license": "BSD-3-Clause"
}
```

`cordis.patch.yml`:
```yaml
- insert:
    - id: ui-skin-spiderman
      name: '@deepseek-ai/dsh-client-ui-skin-spiderman'
```

`tsconfig.json` / `tsconfig.build.json`: same shape as Task 2 (extend `../../tsconfig.base.json`).

`tsdown.config.ts`:
```ts
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@deepseek-ai/dsh-client-ui-skin-spiderman', ['src/index.ts'])
```

`vitest.config.ts`: same as Task 2 but no setup file.

- [ ] **Step 2: Minimal apply**

`src/client/index.ts`:
```ts
import type { Context } from '@deepseek-ai/cordis'

export function apply(ctx: Context): void {
  // Theme + fluid + reveal land in Tasks 12-14.
  void ctx
}
```

Also create `src/invariant.ts` with `export function apply(): void {}`.

- [ ] **Step 3: Typecheck**

Run: `pnpm install && pnpm --filter @deepseek-ai/dsh-client-ui-skin-spiderman typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/dsh-skin-spiderman
git commit -m "feat: scaffold spiderman skin plugin package"
```

---

### Task 12: Skin Theme CSS + apply/dispose

**Files:**
- Create: `packages/dsh-skin-spiderman/src/client/spiderman.module.css`
- Modify: `packages/dsh-skin-spiderman/src/client/index.ts`
- Test: `packages/dsh-skin-spiderman/tests/apply.spec.ts`

**Interfaces:**
- Consumes: CSS Modules auto-inject (loader owns the style tag).
- Produces: `body[data-dsh-spiderman]` scoped theme; `apply` returns via `ctx.effect` a disposer removing the body attribute and injected chrome.

- [ ] **Step 1: Write the failing test**

`tests/apply.spec.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.ts'

function createCtx() {
  let disposer: (() => void) | undefined
  return {
    effect(fn: () => (() => void) | void) {
      const ret = fn()
      if (typeof ret === 'function') disposer = ret
      return ret
    },
    dispose() { disposer?.() },
  }
}

describe('spiderman skin apply/dispose', () => {
  it('sets and clears the body attribute', () => {
    document.body.innerHTML = ''
    const ctx = createCtx() as never
    apply(ctx)
    expect(document.body.dataset.dshSpiderman).toBe('')
    ;(ctx as { dispose(): void }).dispose()
    expect(document.body.dataset.dshSpiderman).toBeUndefined()
  })

  it('removes injected chrome on dispose', () => {
    document.body.innerHTML = ''
    const ctx = createCtx() as never
    apply(ctx)
    expect(document.querySelector('[data-dsh-spiderman-chrome]')).not.toBeNull()
    ;(ctx as { dispose(): void }).dispose()
    expect(document.querySelector('[data-dsh-spiderman-chrome]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @deepseek-ai/dsh-client-ui-skin-spiderman test`
Expected: FAIL (apply currently no-op).

- [ ] **Step 3: Write theme CSS**

`src/client/spiderman.module.css` (red-blue theme variables; all rules scoped under body attribute):
```css
:global(body[data-dsh-spiderman]) {
  --dsh-accent: #d92b3a;
  --dsh-accent-strong: #b91f2b;
  --dsh-accent-blue: #3b6fd4;
  --dsh-accent-blue-strong: #24448f;
  --dsh-bg-deep: #120f1a;
  --dsh-surface: #1b1526;
  --dsh-border: rgba(217, 43, 58, 0.35);
  --dsh-text: #f2f4f8;
  background:
    radial-gradient(circle at 20% 0%, rgba(217, 43, 58, 0.18), transparent 55%),
    radial-gradient(circle at 85% 15%, rgba(59, 111, 212, 0.16), transparent 50%),
    var(--dsh-bg-deep);
  color: var(--dsh-text);
}

:global(body[data-dsh-spiderman]) button,
:global(body[data-dsh-spiderman]) [role='button'] {
  border-color: var(--dsh-border);
}

:global(body[data-dsh-spiderman]) :global(input),
:global(body[data-dsh-spiderman]) :global(textarea) {
  background: rgba(18, 15, 26, 0.75);
  border: 1px solid var(--dsh-border);
  color: var(--dsh-text);
}

.chrome {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(120deg, transparent 0%, rgba(217, 43, 58, 0.06) 40%, rgba(59, 111, 212, 0.08) 100%);
  mix-blend-mode: screen;
}
```

- [ ] **Step 4: Implement apply with injectable chrome hook**

`src/client/index.ts`:
```ts
import type { Context } from '@deepseek-ai/cordis'
import css from './spiderman.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

export function apply(ctx: Context): void {
  ctx.effect(() => {
    document.body.dataset.dshSpiderman = ''

    const chrome = document.createElement('div')
    chrome.dataset.dshSpidermanChrome = ''
    chrome.className = cls('chrome')
    document.body.appendChild(chrome)

    const disposers: Array<() => void> = []
    // Task 13/14 push their disposers into this array.
    void disposers

    return () => {
      chrome.remove()
      delete document.body.dataset.dshSpiderman
      for (const dispose of disposers.splice(0)) dispose()
    }
  }, 'ui-skin-spiderman: theme')
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @deepseek-ai/dsh-client-ui-skin-spiderman test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dsh-skin-spiderman
git commit -m "feat: apply red-blue spiderman theme with reversible dispose"
```

---

### Task 13: Mouse-Follow Fluid Canvas

**Files:**
- Create: `packages/dsh-skin-spiderman/src/client/fluid.ts`
- Modify: `packages/dsh-skin-spiderman/src/client/index.ts`

**Interfaces:**
- Produces:
  - `interface FluidOptions { particleCount?: number; reducedMotion?: boolean }`
  - `function mountFluid(root: HTMLElement, options?: FluidOptions): () => void`
  - Returns disposer that stops rAF loop, removes listeners, removes canvas.

- [ ] **Step 1: Write implementation**

`src/client/fluid.ts`:
```ts
export interface FluidOptions {
  particleCount?: number
}

export function mountFluid(root: HTMLElement, options: FluidOptions = {}): () => void {
  const reduced = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return () => undefined

  const canvas = document.createElement('canvas')
  canvas.dataset.dshSpidermanFluid = ''
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.zIndex = '0'
  canvas.style.pointerEvents = 'none'
  root.appendChild(canvas)

  const ctx2d = canvas.getContext('2d')
  if (ctx2d === null) {
    canvas.remove()
    return () => undefined
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  let width = 0
  let height = 0
  const count = options.particleCount ?? 60
  const particles = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1 + Math.random() * 2,
    vx: (Math.random() - 0.5) * 0.0004,
    vy: (Math.random() - 0.5) * 0.0004,
  }))
  const mouse = { x: -1, y: -1 }

  const resize = (): void => {
    width = window.innerWidth
    height = window.innerHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  const onMove = (event: PointerEvent): void => {
    mouse.x = event.clientX
    mouse.y = event.clientY
  }

  let raf = 0
  const tick = (): void => {
    ctx2d.clearRect(0, 0, width, height)
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      const dx = (mouse.x / width) - p.x
      const dy = (mouse.y / height) - p.y
      p.x += dx * 0.002
      p.y += dy * 0.002
      const px = ((p.x % 1) + 1) % 1 * width
      const py = ((p.y % 1) + 1) % 1 * height
      ctx2d.beginPath()
      ctx2d.arc(px, py, p.r, 0, Math.PI * 2)
      ctx2d.fillStyle = 'rgba(217, 43, 58, 0.55)'
      ctx2d.fill()
    }
    raf = requestAnimationFrame(tick)
  }

  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onMove)
  raf = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onMove)
    canvas.remove()
  }
}
```

- [ ] **Step 2: Wire into apply**

In `src/client/index.ts`, import `mountFluid` and inside the effect after appending chrome:
```ts
disposers.push(mountFluid(document.body))
```

- [ ] **Step 3: Typecheck + test**

Run: `pnpm --filter @deepseek-ai/dsh-client-ui-skin-spiderman typecheck && pnpm --filter @deepseek-ai/dsh-client-ui-skin-spiderman test`
Expected: exit 0, tests PASS (jsdom matchMedia stub is optional; `typeof matchMedia !== 'undefined'` guard covers it).

- [ ] **Step 4: Commit**

```bash
git add packages/dsh-skin-spiderman/src
git commit -m "feat: add mouse-follow fluid particle canvas layer"
```

---

### Task 14: Peter/Suit Identity Reveal

**Files:**
- Create: `packages/dsh-skin-spiderman/src/client/reveal.ts`
- Modify: `packages/dsh-skin-spiderman/src/client/index.ts`
- Create: `packages/dsh-skin-spiderman/src/client/reveal.module.css`

**Interfaces:**
- Produces: `function mountReveal(root: HTMLElement, images: { peter: string; suit: string }): () => void`
  - Injects a fixed element at bottom-left: two stacked images clipped by pointer position (clip-path inset reveal); returns disposer removing element.

- [ ] **Step 1: Write implementation**

`src/client/reveal.module.css`:
```css
.reveal {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 1;
  width: 180px;
  height: 240px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(217, 43, 58, 0.4);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
}
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.suit { z-index: 1; }
.peter { z-index: 2; }
```

`src/client/reveal.ts`:
```ts
import css from './reveal.module.css'

const cls = (name: keyof typeof css): string => css[name] ?? ''

export interface RevealImages {
  peter: string
  suit: string
}

export function mountReveal(root: HTMLElement, images: RevealImages): () => void {
  const wrap = document.createElement('div')
  wrap.className = cls('reveal')
  wrap.dataset.dshSpidermanReveal = ''

  const suit = document.createElement('img')
  suit.className = cls('layer') + ' ' + cls('suit')
  suit.src = images.suit
  suit.alt = ''
  const peter = document.createElement('img')
  peter.className = cls('layer') + ' ' + cls('peter')
  peter.src = images.peter
  peter.alt = ''
  wrap.append(suit, peter)
  root.appendChild(wrap)

  // Pointer position horizontally reveals Peter over the suit (0% left = suit, 100% left = Peter).
  const onMove = (event: PointerEvent): void => {
    const rect = wrap.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const clip = `${Math.round(ratio * 100)}% 0`
    peter.style.clipPath = `inset(0 ${clip})`
  }
  window.addEventListener('pointermove', onMove)

  return () => {
    window.removeEventListener('pointermove', onMove)
    wrap.remove()
  }
}
```

- [ ] **Step 2: Copy skin assets and wire in**

```bash
mkdir -p packages/dsh-skin-spiderman/src/assets
node -e '
const sharp = require("sharp")
const fs = require("fs")
const peter = fs.readFileSync("/Users/aadmin/tool/蜘蛛侠网页_图片保留_视频可替换/public/home-cover-peter.jpg")
const suit = fs.readFileSync("/Users/aadmin/tool/蜘蛛侠网页_图片保留_视频可替换/public/home-cover-suit.jpg")
async function main() {
  const [p, s] = await Promise.all([
    sharp(peter).resize(360, 480, { fit: "cover" }).webp({ quality: 78 }).toBuffer(),
    sharp(suit).resize(360, 480, { fit: "cover" }).webp({ quality: 78 }).toBuffer(),
  ])
  const ts = `/** Skin assets as data URLs (no static files shipped). */\n` +
    `export const PETER_URL = "data:image/webp;base64,${p.toString("base64")}"\n` +
    `export const SUIT_URL = "data:image/webp;base64,${s.toString("base64")}"\n`
  fs.mkdirSync("packages/dsh-skin-spiderman/src/assets", { recursive: true })
  fs.writeFileSync("packages/dsh-skin-spiderman/src/assets/reveal.ts", ts)
}
main()
'
```

In `src/client/index.ts`, import `mountReveal` and the two data-URL constants:
```ts
import { PETER_URL, SUIT_URL } from '../assets/reveal.ts'

disposers.push(mountReveal(document.body, {
  peter: PETER_URL,
  suit: SUIT_URL,
}))
```

- [ ] **Step 3: Typecheck + test**

Run: `pnpm --filter @deepseek-ai/dsh-client-ui-skin-spiderman typecheck && pnpm --filter @deepseek-ai/dsh-client-ui-skin-spiderman test`
Expected: PASS (test asserts chrome removal only; reveal element removed via disposers array).

- [ ] **Step 4: Commit**

```bash
git add packages/dsh-skin-spiderman
git commit -m "feat: add peter/suit identity reveal with pointer clip"
```

---

### Task 15: Pet Sprite Sheet Generation (external API)

**Files:**
- Create: `素材/spidey/pet-poses/` (generated JPEGs)
- Create: `素材/spidey/pet.json` (frame table)
- Test: `packages/dsh-spider-pet/tests/spritesheet.spec.ts` already covers parsing; manual visual check.

**Interfaces:**
- Produces: six pose images (idle/waiting/thinking/jumping/pet/failed) and `素材/spidey/pet.json` with `frames: [6,6,6,5,4,4]` and `rows` map.

- [ ] **Step 1: Generate poses via seedream edit**

For each of the six poses, call the relay endpoint as a chat completion with the confirmed transparent PNG as `image_url` reference. Environment: `export SPIDEY_KEY='<key supplied by user>'`. One request per pose:

```bash
curl -s --max-time 300 https://www.geeknow.top/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SPIDEY_KEY" \
  -d "$(node -e '
    const fs = require("fs")
    const b = fs.readFileSync("素材/spidey/spidey-v1-white-eyes.png").toString("base64")
    const pose = process.argv[1]
    const prompt = {
      idle: "保持角色完全不变，让角色处于站立待机姿态，轻轻呼吸浮动",
      waiting: "保持角色完全不变，让角色低头等待的姿态，有点无聊地踢脚",
      thinking: "保持角色完全不变，让角色单手托腮思考的姿态",
      jumping: "保持角色完全不变，让角色跳跃庆祝的姿态，单手高举",
      pet: "保持角色完全不变，让角色享受摸头的眯眼满足姿态",
      failed: "保持角色完全不变，让角色趴在地上沮丧的姿态"
    }[pose]
    const body = { model: "doubao-seedream-5-0-260128", messages: [{ role: "user", content: [{ type: "text", text: prompt + "，纯色绿色背景，无文字无水印" }, { type: "image_url", image_url: { url: "data:image/png;base64," + b } }] }] }
    process.stdout.write(JSON.stringify(body))
  ' idle)"
```

Save each response content URL to `素材/spidey/pet-poses/<pose>.jpeg` (extract with the same regex used earlier: `/https:\/\/[^\s\)\"]+/`). Verify visually that each pose keeps the same character.

- [ ] **Step 2: Record API note**

The API key must be provided by the user at execution time; never commit it. If a pose fails moderation or drifts from the reference, retry once with a slightly different pose wording, then report to the user.

- [ ] **Step 3: Commit**

```bash
git add 素材/spidey
git commit -m "assets: generate spider-pet pose frames"
```

---

### Task 16: Build Sprite Sheet + pet.json

**Files:**
- Create: `scripts/build-spritesheet.mjs`
- Create: `素材/spidey/spritesheet.png`
- Create: `素材/spidey/spritesheet.webp`
- Create: `素材/spidey/pet.json`
- Create: `packages/dsh-spider-pet/src/assets/spritesheet.ts` (real data URL)
- Test: run the script and validate output geometry.

**Interfaces:**
- Produces: `spritesheet.png` 8 columns x 6 rows, 256x256 cells (2048x1536); `spritesheet.webp` (smaller, used in the bundle); `pet.json` `{ rows: { idle:0, waiting:1, thinking:2, jumping:3, pet:4, failed:5 }, frames: [6,6,6,5,4,4], cell: { width:256, height:256 } }`; `src/assets/spritesheet.ts` exporting `SPRITE_SHEET_URL` as a WebP base64 data URL.

- [ ] **Step 1: Write the build script**

`scripts/build-spritesheet.mjs`:
```js
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const POSES = ['idle', 'waiting', 'thinking', 'jumping', 'pet', 'failed']
const FRAMES = [6, 6, 6, 5, 4, 4]
const CELL = 256
const COLS = 8
const srcDir = join(process.cwd(), '素材/spidey/pet-poses')
const outDir = join(process.cwd(), '素材/spidey')

const rows = {}
const images = []
for (let r = 0; r < POSES.length; r++) {
  const name = POSES[r]
  rows[name] = r
  const file = join(srcDir, `${name}.jpeg`)
  const buf = await sharp(file).resize(CELL, CELL, { fit: 'cover' }).ensureAlpha().toBuffer()
  images.push({ name, buf, count: FRAMES[r] })
}

// Place the single generated frame at cell (row, 0); other cells stay transparent.
const canvas = sharp({
  create: { width: COLS * CELL, height: POSES.length * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
const composites = images.map(({ buf }, row) => ({
  input: buf,
  left: 0,
  top: row * CELL,
}))
const png = await canvas.composite(composites).png().toBuffer()
const webp = await canvas.composite(composites).webp({ quality: 80 }).toBuffer()
writeFileSync(join(outDir, 'spritesheet.png'), png)
writeFileSync(join(outDir, 'spritesheet.webp'), webp)
writeFileSync(join(outDir, 'pet.json'), JSON.stringify({
  rows,
  frames: FRAMES,
  cell: { width: CELL, height: CELL },
}, null, 2) + '\n')
writeFileSync(
  join(process.cwd(), 'packages/dsh-spider-pet/src/assets/spritesheet.ts'),
  '/** Sprite sheet as WebP base64 data URL (no static file shipped). */\n' +
    `export const SPRITE_SHEET_URL = 'data:image/webp;base64,${webp.toString('base64')}'\n`,
)
console.log('wrote spritesheet.png, spritesheet.webp, pet.json and spritesheet.ts')
```

Note: with one frame per row, `frames` counts describe per-state looping frame counts; the client indexes `index % count`, so a count > 1 simply holds the single frame for that many ticks (acceptable first version, upgraded in 2.0 with real multi-frame rows).

- [ ] **Step 2: Run the script and validate**

Run: `node scripts/build-spritesheet.mjs`
Then:
```bash
node -e "const m=require('sharp'); m('素材/spidey/spritesheet.png').metadata().then(d=>console.log(d.width, d.height))"
```
Expected: `2048 1536`.

- [ ] **Step 3: Verify the placeholder was replaced**

Run: `node -e "const s = require('fs').readFileSync('packages/dsh-spider-pet/src/assets/spritesheet.ts','utf8'); if (!s.includes('data:image/webp;base64,') || s.trim().endsWith('base64,\'')) { console.error('placeholder still present'); process.exit(1) } console.log('spritesheet.ts replaced')"`

Also verify `packages/dsh-spider-pet/src/client/index.ts` still imports `SPRITE_SHEET_URL` from `../assets/spritesheet.ts` and `FRAME_TABLE` literals match `pet.json` (`rows`/`frames`/`cell`).

- [ ] **Step 4: Commit**

```bash
git add scripts/build-spritesheet.mjs 素材/spidey packages/dsh-spider-pet/src/assets
git commit -m "feat: generate pet sprite sheet and frame table"
```

---

### Task 17: Workspace Build + Test Pass

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Install sharp and any missing deps**

Run: `pnpm install`
Expected: lockfile updated, workspace links resolved.

- [ ] **Step 2: Full build**

Run: `pnpm -r build`
Expected: both packages emit `lib/index.js`, `lib/client.js`, `lib/types/**`.

- [ ] **Step 3: Full tests + typecheck**

Run: `pnpm -r test && pnpm -r typecheck`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: full workspace build and test pass"
```

---

### Task 18: Install into web profile and smoke test

**Files:**
- Modify: user's `~/.dsh/profiles/web/` (runtime install, not committed)

- [ ] **Step 1: Install both plugins**

```bash
dsh plugin --profile web add link:/Users/aadmin/tool/deepseek-plugin/packages/dsh-spider-pet
dsh plugin --profile web add link:/Users/aadmin/tool/deepseek-plugin/packages/dsh-skin-spiderman
```

If the earlier `workspace:*` dependency resolution issue appears, verify the profile `node_modules/@deepseek-ai/` contains `dsh-spider-pet` and `dsh-client-ui-skin-spiderman` symlinks; otherwise use the single-package link pattern proven earlier (no aggregate package involved here, so this should be direct).

- [ ] **Step 2: Restart dsh web and verify**

```bash
dsh web
```
Expected: `http://127.0.0.1:3080` renders; pet appears bottom-right; skin applied when enabled (body attribute present); reveal element bottom-left.

- [ ] **Step 3: Check bundle routes**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/plugins/@deepseek-ai/dsh-spider-pet/client.js
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/plugins/@deepseek-ai/dsh-client-ui-skin-spiderman/client.js
```
Expected: `200` for both.

- [ ] **Step 4: Commit any fix-ups**

```bash
git add -A
git commit -m "fix: smoke-test install fixes"
```

---

## Self-Review Notes

- Spec coverage: design sections 3.1/3.2 -> Tasks 2-10; section 4 -> Tasks 11-14; section 5 -> Tasks 15-16; sections 6-8 -> Tasks 17-18. Design section 9 (2.0) and 10 (out of scope) intentionally have no tasks.
- Placeholder scan: no TBD/TODO; the `sharp` placeholder line in Task 16 is corrected inline in the same task.
- Type consistency: `PetController.getSnapshot()` returns `{ persist, activity, petTriggered, animation }`; `animationFor`/`applyInteraction` signatures match across Tasks 3-9; `mountFluid`/`mountReveal` both return `() => void` disposers pushed into the skin `disposers` array.
