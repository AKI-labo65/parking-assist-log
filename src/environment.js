export const IS_PREVIEW = import.meta.env.VITE_APP_ENV === 'preview'

export function storageKeys(preview = IS_PREVIEW) {
  const prefix = preview ? 'parking-assist-preview' : 'parking-assist'
  return {
    records: `${prefix}-records:`,
    work: `${prefix}-work:`,
    settings: `${prefix}-settings`,
    theme: `${prefix}-theme`,
    tutorial: `${prefix}-tutorial:v1`,
  }
}

export const STORAGE_KEYS = storageKeys()

export function hasSeenTutorial() {
  try {
    return localStorage.getItem(STORAGE_KEYS.tutorial) !== null
  } catch {
    return false
  }
}

export function rememberTutorial(result) {
  try {
    localStorage.setItem(STORAGE_KEYS.tutorial, result)
  } catch {
    // The guide can still be used when browser storage is unavailable.
  }
}
