import { STORAGE_KEYS } from './environment.js'

export const WORKSPACE_OPTIONS = [
  { id: 'record', label: '駐車場' },
  { id: 'issued', label: '精算待ち' },
  { id: 'history', label: '履歴' },
]

const DEFAULT_VIEWS = { left: 'record', center: 'issued', right: 'issued' }

export const PANE_LABELS = { left: '左側', center: '中央', right: '右側' }

export function paneSides(count) {
  return count === 3 ? ['left', 'center', 'right'] : ['left', 'right']
}

// 3画面に切り替えた時、同じ表示が重なっていれば空いている表示で埋める
export function fillThreePaneViews(views) {
  if (new Set([views.left, views.center, views.right]).size === 3) return views
  const center = views.right
  const right = WORKSPACE_OPTIONS.find((option) => option.id !== views.left && option.id !== center)?.id || views.right
  return { ...views, center, right }
}

export function loadWorkspaceViews() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.workspace))
    return Object.fromEntries(Object.entries(DEFAULT_VIEWS).map(([side, fallback]) => [
      side,
      WORKSPACE_OPTIONS.some((option) => option.id === saved?.[side]) ? saved[side] : fallback,
    ]))
  } catch {
    return { ...DEFAULT_VIEWS }
  }
}

export function saveWorkspaceViews(views) {
  try {
    localStorage.setItem(STORAGE_KEYS.workspace, JSON.stringify(views))
  } catch {
    // Pane selection remains usable when browser storage is unavailable.
  }
}

export function loadNavigationSide() {
  try {
    return localStorage.getItem(STORAGE_KEYS.navigationSide) === 'left' ? 'left' : 'right'
  } catch {
    return 'right'
  }
}

export function saveNavigationSide(side) {
  try {
    localStorage.setItem(STORAGE_KEYS.navigationSide, side)
  } catch {
    // Moving the navigation remains available without persistent storage.
  }
}

export function loadPaneCount() {
  try {
    return localStorage.getItem(STORAGE_KEYS.paneCount) === '3' ? 3 : 2
  } catch {
    return 2
  }
}

export function savePaneCount(count) {
  try {
    localStorage.setItem(STORAGE_KEYS.paneCount, String(count))
  } catch {
    // The pane count still works for this session without storage.
  }
}
