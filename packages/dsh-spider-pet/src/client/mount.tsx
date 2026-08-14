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

  const render = (): void => {
    root.render(
      <PetView
        controller={controller}
        meta={meta}
        table={table}
        sheetUrl={sheetUrl}
        onInteract={() => { controller.interact('pet') }}
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
