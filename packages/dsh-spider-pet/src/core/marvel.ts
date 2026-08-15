/**
 * Marvel hero-selection protocol shared with the skin plugin.
 *
 * The client purity gate forbids cross-plugin value imports, so the skin
 * plugin keeps an identical copy of this module (same keys/events). Keep
 * `MARVEL_HEROES` in sync with the sibling package when shipping a hero.
 */

/** Persisted selection pair: independent skin and pet choices. */
export const MARVEL_STORAGE_KEY = 'dsh.marvel.v1'
export const MARVEL_SKIN_EVENT = 'dsh:marvel-skin-change'
export const MARVEL_PET_EVENT = 'dsh:marvel-pet-change'

export interface MarvelSelections {
  skin: string
  pet: string
}

export const DEFAULT_SELECTIONS: MarvelSelections = {
  skin: 'spiderman',
  pet: 'spiderman',
}

/** Heroes surfaced in the settings pickers. Append here as content ships
 *  (both this package and the skin package must add the hero together). */
export const MARVEL_HEROES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'spiderman', label: '蜘蛛侠' },
]

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

export function saveMarvelSelections(
  storage: Pick<Storage, 'setItem'>,
  patch: Partial<MarvelSelections>,
  current: MarvelSelections,
): MarvelSelections {
  const next: MarvelSelections = { ...current, ...patch }
  try {
    storage.setItem(MARVEL_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable (private mode): keep in-memory state working.
  }
  return next
}
