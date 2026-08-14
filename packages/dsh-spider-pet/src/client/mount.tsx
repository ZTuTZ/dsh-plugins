import { createRoot, type Root } from 'react-dom/client'
import type { PetController } from '../core/controller.ts'
import type { FrameTable, SpriteSheetMeta } from '../core/spritesheet.ts'
import { PetView } from './PetView.tsx'

export const PET_VIEW_SELECTOR = '[data-dsh-spider-pet]'

export function mountPet(
  controller: PetController,
  meta: SpriteSheetMeta,
  table: FrameTable,
  sheetUrl: string,
): () => void {
  const container = document.createElement('div')
  container.dataset.dshSpiderPetRoot = ''
  document.body.appendChild(container)
  const root: Root = createRoot(container)

  let panelOpen = false
  const togglePanel = (): void => { panelOpen = !panelOpen }

  const onDrag = (event: React.PointerEvent): void => {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const base = controller.getSnapshot().persist.display
    const move = (ev: PointerEvent): void => {
      controller.setDisplay({
        right: Math.max(0, base.right - (ev.clientX - startX)),
        bottom: Math.max(0, base.bottom - (ev.clientY - startY)),
      })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const render = (): void => {
    root.render(
      <PetView
        controller={controller}
        meta={meta}
        table={table}
        sheetUrl={sheetUrl}
        onInteract={() => { controller.interact('pet') }}
        onPanel={togglePanel}
        panelOpen={panelOpen}
        onDrag={onDrag}
      />,
    )
  }
  const unsubscribe = controller.subscribe(render)
  render()

  return () => {
    unsubscribe()
    root.unmount()
    container.remove()
  }
}
