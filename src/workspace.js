import { STORAGE_KEYS } from './environment.js'

export const WORKSPACE_OPTIONS = [
  { id: 'record', label: '駐車場' },
  { id: 'issued', label: '精算待ち' },
  { id: 'history', label: '履歴' },
]

const DEFAULT_VIEWS = { left: 'record', right: 'issued' }

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
