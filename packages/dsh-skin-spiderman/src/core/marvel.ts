/**
 * Marvel hero-selection protocol shared with the pet plugin.
 *
 * The client purity gate forbids cross-plugin value imports, so the pet
 * plugin keeps an equivalent module with the same keys/events. This copy
 * only exposes what the skin needs (the skin selection).
 */

export const MARVEL_STORAGE_KEY = 'dsh.marvel.v1'
export const MARVEL_SKIN_EVENT = 'dsh:marvel-skin-change'

export interface MarvelSelections {
  skin: string
  pet: string
}

export const DEFAULT_SELECTIONS: MarvelSelections = {
  skin: 'spiderman',
  pet: 'spiderman',
}

export function readMarvelSelections(
  storage: Pick<Storage, 'getItem'>,
): MarvelSelections {
  try {
    const raw = storage.getItem(MARVEL_STORAGE_KEY)
    if (!raw) return DEFAULT_SELECTIONS
    const parsed = JSON.parse(raw) as Partial<MarvelSelections>
    return {
      skin: typeof parsed.skin === 'string' ? parsed.skin : DEFAULT_SELECTIONS.skin,
      pet: typeof parsed.pet === 'string' ? parsed.pet : DEFAULT_SELECTIONS.pet,
    }
  } catch {
    return DEFAULT_SELECTIONS
  }
}
