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
