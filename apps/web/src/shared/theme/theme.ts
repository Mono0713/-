/** Light / dark choice, kept in this browser only. "system" follows the device. */
export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_KEY = 'sheetloop-theme'

/** Sets data-theme on <html> from the saved choice; inlined in <head> so the page never flashes. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

export function readTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, choice)
  } catch {
    // private windows may refuse storage; the choice still applies to this page
  }
}
