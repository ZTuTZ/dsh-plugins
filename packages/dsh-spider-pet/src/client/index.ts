import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

export const inject = ['slots', 'locale', 'connection', 'settingsScope']

export function apply(ctx: ClientContext): void {
  // Browser behavior lands in Tasks 8-10. Skeleton keeps the module loadable.
  void ctx
}
