import type { Context } from '@deepseek-ai/cordis'

/** Host half: the skin is a pure browser plugin; nothing runs on the host side. */
export function apply(ctx: Context): void {
  void ctx
}
