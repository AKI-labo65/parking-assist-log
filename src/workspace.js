import { STORAGE_KEYS } from './environment.js'

export const WORKSPACE_OPTIONS = [
  { id: 'record', label: '駐車場' },
  { id: 'issued', label: '精算待ち' },
  { id: 'history', label: '履歴' },
]

const DEFAULT_VIEWS = { left: 'record', right: 'issued' }

export const PANE_LABELS = { left: '左側', center: '中央', right: '右側' }

export function paneSides(count) {
  return count === 3 ? ['left', 'center', 'right'] : ['left', 'right']
}

// 3画面は左から駐車場・精算待ち・履歴で固定する
export const THREE_PANE_VIEWS = { left: 'record', center: 'issued', right: 'history' }

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
