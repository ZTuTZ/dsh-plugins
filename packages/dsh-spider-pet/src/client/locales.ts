/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'settings.title': '漫威桌宠',
  'settings.visibility': '隐藏',
  'settings.name': '名字',
  'pet.summon': '召唤{name}',
  'pet.feedback': '嗷呜～',
} satisfies Record<string, string>

/** The spider-pet key union. */
export type PetLocaleKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'settings.title': 'Marvel Pet',
  'settings.visibility': 'Hide',
  'settings.name': 'Name',
  'pet.summon': 'Summon {name}',
  'pet.feedback': 'Meep!',
} satisfies Record<string, string>
