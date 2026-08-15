import { useEffect, useState, type CSSProperties } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { APP_STORAGE_KEY, APP_TOGGLE_EVENT, readAppEnabled } from '../core/controller.ts'
import {
  MARVEL_HEROES,
  MARVEL_PET_EVENT,
  MARVEL_SKIN_EVENT,
  MARVEL_STORAGE_KEY,
  readMarvelSelections,
  saveMarvelSelections,
} from '../core/marvel.ts'
import { HERO_PETS } from '../heroes/spiderman.ts'
import type { PetLocaleKey } from './locales.ts'

/** Props the official Plugins settings section binds for its tabs. */
export interface MarvelSettingsTabInjected {
  /** The tab needs no injected face; selections share localStorage. */
}

export type MarvelSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<PetLocaleKey>
  & InjectFace<MarvelSettingsTabInjected>

const PET_OPTIONS = MARVEL_HEROES.filter((hero) => hero.id in HERO_PETS)
// Skin availability lives in the skin plugin; both packages ship heroes in
// lockstep, so the shared hero list is the skin picker source.
const SKIN_OPTIONS = MARVEL_HEROES

const pill = (active: boolean): CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 999,
  border: active ? '1px solid #d92b3a' : '1px solid rgba(255,255,255,.14)',
  background: active ? 'rgba(217,43,58,.2)' : 'rgba(255,255,255,.04)',
  color: active ? '#fff' : '#9aa4b2',
  cursor: 'pointer',
  fontSize: 13,
})

/**
 * Marvel control center inside the official Plugins settings page: master
 * switch plus independent skin and pet selectors. Writes the shared
 * `dsh.marvel.v1` selections and broadcasts change events so the skin and
 * pet plugins (which listen to the same keys/events) hot-swap their content.
 */
export function MarvelSettingsTab(_props: MarvelSettingsTabProps): JSX.Element {
  const [enabled, setEnabled] = useState(() => readAppEnabled(localStorage))
  const [selections, setSelections] = useState(() => readMarvelSelections(localStorage))

  useEffect(() => {
    const refresh = (): void => {
      setEnabled(readAppEnabled(localStorage))
      setSelections(readMarvelSelections(localStorage))
    }
    window.addEventListener(APP_TOGGLE_EVENT, refresh)
    window.addEventListener(MARVEL_SKIN_EVENT, refresh)
    window.addEventListener(MARVEL_PET_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(APP_TOGGLE_EVENT, refresh)
      window.removeEventListener(MARVEL_SKIN_EVENT, refresh)
      window.removeEventListener(MARVEL_PET_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const toggle = (): void => {
    const next = !enabled
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ enabled: next }))
    window.dispatchEvent(new CustomEvent(APP_TOGGLE_EVENT, { detail: { enabled: next } }))
    setEnabled(next)
  }

  const selectSkin = (id: string): void => {
    const next = saveMarvelSelections(localStorage, { skin: id }, readMarvelSelections(localStorage))
    setSelections(next)
    window.dispatchEvent(new CustomEvent(MARVEL_SKIN_EVENT, { detail: { id } }))
  }

  const selectPet = (id: string): void => {
    const next = saveMarvelSelections(localStorage, { pet: id }, readMarvelSelections(localStorage))
    setSelections(next)
    window.dispatchEvent(new CustomEvent(MARVEL_PET_EVENT, { detail: { id } }))
  }

  return (
    <div data-dsh-marvel-tab="">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>漫威应用（宠物 + 皮肤）</div>
      <div style={{ color: '#9aa4b2', fontSize: 12, marginBottom: 8 }}>
        {enabled ? '已开启：桌宠和英雄皮肤主题生效' : '已关闭：桌宠和皮肤主题均不显示'}
      </div>
      <button type="button" onClick={toggle}>{enabled ? '关闭' : '打开'}</button>

      <div style={{ fontWeight: 600, marginTop: 22, marginBottom: 6 }}>桌宠</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PET_OPTIONS.map((hero) => (
          <button
            key={hero.id}
            type="button"
            style={pill(selections.pet === hero.id)}
            onClick={() => { selectPet(hero.id) }}
          >
            {hero.label}
          </button>
        ))}
      </div>

      <div style={{ fontWeight: 600, marginTop: 22, marginBottom: 6 }}>皮肤</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SKIN_OPTIONS.map((hero) => (
          <button
            key={hero.id}
            type="button"
            style={pill(selections.skin === hero.id)}
            onClick={() => { selectSkin(hero.id) }}
          >
            {hero.label}
          </button>
        ))}
      </div>
    </div>
  )
}
