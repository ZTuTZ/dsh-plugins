import { PETER_URL, SUIT_URL } from '../assets/reveal.ts'
import { SPIDER_MARK_URL } from '../assets/mark.ts'
import { SUIT_TEXTURE_URL } from '../assets/texture.ts'
import type { HeroSkinContent } from '../core/theme.ts'

/** Spider-Man skin content: the original v0.1 palette, reveal and decor. */
export const spidermanSkin: HeroSkinContent = {
  id: 'spiderman',
  label: '蜘蛛侠',
  kicker: 'Spider-Man / Workspace',
  statusName: 'Peter Parker',
  markUrl: SPIDER_MARK_URL,
  textureUrl: SUIT_TEXTURE_URL,
  figures: { base: SUIT_URL, reveal: PETER_URL },
}

export const HERO_SKINS: Record<string, HeroSkinContent> = {
  spiderman: spidermanSkin,
}
