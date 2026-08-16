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

  const render = (): void => {
    root.render(
      <PetView
        controller={controller}
        meta={meta}
        table={table}
        sheetUrl={sheetUrl}
        onInteract={() => { controller.interact() }}
        onPetInteract={() => { controller.interactPet() }}
        onPanel={togglePanel}
        panelOpen={panelOpen}
      />,
    )
  }
  // Flip the flag and immediately re-render: React only sees `panelOpen`
  // through the props we pass here, so toggling the closure variable alone
  // would leave the panel stuck until some unrelated notify() triggers a
  // render (the open/close felt delayed or dead entirely).
  const togglePanel = (): void => {
    panelOpen = !panelOpen
    render()
  }
  const unsubscribe = controller.subscribe(render)
  render()

  return () => {
    unsubscribe()
    root.unmount()
    container.remove()
  }
}
