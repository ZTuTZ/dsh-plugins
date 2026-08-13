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
