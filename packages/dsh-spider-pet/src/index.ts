import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { Session } from '@deepseek-ai/dsh-session'
import z from 'schemastery'
import type {} from '@deepseek-ai/dsh-system-prompt'

export const inject = ['systemPrompt', 'webServer']

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

const GUIDANCE = '本机已安装 dsh-spider-pet 插件：右下角有一只蜘蛛侠卡通宠物，会跟随模型工作状态切换动画，可点击摸头、改名、拖动；用户提到「宠物/蜘蛛侠/蛛蛛侠」时即指本插件。'

/**
 * Pet phases derived from the harness's own session events. The official
 * build has no `activity/status` event (that came from a dsh-web-ui helper
 * plugin that is not installed), so the tracker maps the real event
 * vocabulary onto the pet's animation rows:
 *   turn/start + tool/call → thinking (working), turn/end → done
 *   (celebrate), user/message → waiting, session end → idle.
 */
type ActivityPhase = 'idle' | 'waiting' | 'thinking' | 'done'

/** Host-side pet activity tracker + HTTP surface. */
export function makePetActivity(ctx: Context): {
  state: () => { phase: ActivityPhase; phrase?: string; line?: string }
  dispose: () => void
} {
  let phase: ActivityPhase = 'idle'
  let phrase: string | undefined
  let turnActive = false
  let celebrateUntil = 0
  const now = (): number => Date.now()
  const offs = [
    ctx.on('session/event', (_session: Session, event: { type: string; data?: unknown }) => {
      switch (event.type) {
        case 'turn/start':
        case 'step/start':
          turnActive = true
          phase = 'thinking'
          break
        case 'tool/call': {
          turnActive = true
          phase = 'thinking'
          const name = (event.data as { name?: unknown } | undefined)?.name
          phrase = typeof name === 'string' ? `正在调用 ${name}` : undefined
          break
        }
        case 'tool/result':
          if (turnActive) {
            phase = 'thinking'
            phrase = undefined
          }
          break
        case 'turn/end':
          turnActive = false
          phase = 'done'
          celebrateUntil = now() + 2400
          phrase = undefined
          break
        case 'user/message':
          turnActive = false
          phase = 'waiting'
          phrase = undefined
          break
      }
    }),
    ctx.on('session/disposed', () => {
      turnActive = false
      phase = 'idle'
      phrase = undefined
      celebrateUntil = 0
    }),
  ]
  return {
    state: () => {
      // The celebration window after a turn settles back to idle.
      if (phase === 'done' && now() >= celebrateUntil) phase = 'idle'
      return { phase, ...(phrase === undefined ? {} : { phrase }) }
    },
    dispose: () => { for (const off of offs) off() },
  }
}

const ACTIVITY_STATE_PATH = '/api/spider-pet/state'

function json(res: { writeHead(status: number, headers: Record<string, string>): void; end(body: string): void }, body: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function stateRoute(tracker: ReturnType<typeof makePetActivity>): WebRoute {
  return {
    kind: 'exact',
    path: ACTIVITY_STATE_PATH,
    handler: (req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end()
        return
      }
      json(res, tracker.state())
    },
  }
}

export function apply(ctx: Context, config: Config = {}): void {
  let current: () => Config = () => config ?? {}
  let disposeAll: (() => void) | undefined

  const sync = (): void => {
    disposeAll?.()
    disposeAll = undefined
    if ((current().enabled ?? true) === false) return
    const disposers: Array<() => void> = []
    const tracker = makePetActivity(ctx)
    disposers.push(tracker.dispose)
    disposers.push(ctx.effect(() => {
      const disposeRoute = ctx.webServer.register(stateRoute(tracker))
      return () => { disposeRoute() }
    }, 'spider-pet: activity route'))
    if ((current().announceToAgent ?? true) !== false) {
      disposers.push(ctx.systemPrompt.section({
        name: 'plugin:spider-pet',
        order: 200,
        text: GUIDANCE,
      }))
    }
    disposeAll = () => { for (const dispose of disposers) dispose() }
  }

  installSettingsSection(ctx, SPIDER_PET_SETTINGS_NAMESPACE, Config, config ?? {}, {
    setSource: (source) => { current = source },
    onChange: sync,
  })
  sync()
}
