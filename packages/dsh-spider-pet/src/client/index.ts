import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { PetController } from '../core/controller.ts'
import type { FrameTable } from '../core/spritesheet.ts'
import { SPRITE_SHEET_URL } from '../assets/spritesheet.ts'
import { mountPet } from './mount.tsx'

export const inject = ['slots', 'locale', 'settingsScope']

export const SPRITE_META = { framesPerRow: 8, cellWidth: 256, cellHeight: 256 } as const

export const FRAME_TABLE: FrameTable = {
  rows: { idle: 0, waiting: 1, thinking: 2, jumping: 3, pet: 4, failed: 5 },
  frames: [6, 6, 6, 5, 4, 4],
}

export function apply(ctx: ClientContext): void {
  const storage = typeof localStorage !== 'undefined' ? localStorage : undefined
  if (storage === undefined) return
  const controller = new PetController({ storage })

  const settingsScope = ctx.settingsScope.bind<{ enabled?: boolean }>({ namespace: 'spider-pet' })
  let disposer: (() => void) | undefined
  const syncEnabled = (): void => {
    const scope = settingsScope.getSnapshot()
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
  settingsScope.subscribe(syncEnabled)
  syncEnabled()
}
