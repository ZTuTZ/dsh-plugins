/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'settings.title': '蜘蛛侠宠物',
  'settings.visibility': '隐藏',
  'settings.name': '名字',
} satisfies Record<string, string>

/** The spider-pet key union. */
export type PetLocaleKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'settings.title': 'Spider Pet',
  'settings.visibility': 'Hide',
  'settings.name': 'Name',
} satisfies Record<string, string>
