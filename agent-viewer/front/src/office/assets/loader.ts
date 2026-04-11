import { SHEETS, type SheetId } from './catalog'

const loaded = new Map<SheetId, HTMLImageElement>()
const loading = new Map<SheetId, Promise<HTMLImageElement>>()
let ready = false
let onReadyCallbacks: Array<() => void> = []

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${url}`))
    img.src = url
  })
}

export async function preloadSheets(): Promise<void> {
  const ids: SheetId[] = ['modernCity', 'tinyTown']
  for (const id of ids) {
    if (loaded.has(id) || loading.has(id)) continue
    const promise = loadImage(SHEETS[id].url)
    loading.set(id, promise)
    try {
      const img = await promise
      loaded.set(id, img)
    } catch (err) {
      console.warn('[office-assets] failed to load sheet', id, err)
    } finally {
      loading.delete(id)
    }
  }
  ready = true
  for (const cb of onReadyCallbacks) cb()
  onReadyCallbacks = []
}

export function isAssetsReady(): boolean {
  return ready
}

export function onAssetsReady(cb: () => void): void {
  if (ready) cb()
  else onReadyCallbacks.push(cb)
}

export function getSheet(id: SheetId): HTMLImageElement | null {
  return loaded.get(id) ?? null
}

export function drawTileFromSheet(
  ctx: CanvasRenderingContext2D,
  sheetId: SheetId,
  col: number,
  row: number,
  dx: number,
  dy: number,
  dw: number = SHEETS[sheetId].tileSize,
  dh: number = SHEETS[sheetId].tileSize,
): boolean {
  const img = loaded.get(sheetId)
  if (!img) return false
  const size = SHEETS[sheetId].tileSize
  const sx = col * size
  const sy = row * size
  ctx.drawImage(img, sx, sy, size, size, dx, dy, dw, dh)
  return true
}
