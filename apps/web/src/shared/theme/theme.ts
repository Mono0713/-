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
  // Every color changes in the same frame: color transitions (fields, buttons, cards) are held off
  // while the theme switches, or some would trail behind the rest and flash. See globals.css.
  root.dataset.themeSwitching = ''
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  void root.offsetHeight // apply the new colors now, with transitions off
  requestAnimationFrame(() => requestAnimationFrame(() => delete root.dataset.themeSwitching))
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, choice)
  } catch {
    // private windows may refuse storage; the choice still applies to this page
  }
}
