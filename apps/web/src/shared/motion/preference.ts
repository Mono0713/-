/** "做題時減少動畫": quiz screens change without motion. Kept in this browser only, like the theme. */
export const MOTION_KEY = 'sheetloop-motion'

/** Sets data-motion on <html> from the saved choice; inlined in <head> with the theme script. */
export const MOTION_SCRIPT = `try{if(localStorage.getItem('${MOTION_KEY}')==='calm')document.documentElement.dataset.motion='calm'}catch(e){}`

export function readCalm(): boolean {
  try {
    return localStorage.getItem(MOTION_KEY) === 'calm'
  } catch {
    return false
  }
}

export function applyCalm(calm: boolean) {
  const root = document.documentElement
  if (calm) root.dataset.motion = 'calm'
  else delete root.dataset.motion
  try {
    if (calm) localStorage.setItem(MOTION_KEY, 'calm')
    else localStorage.removeItem(MOTION_KEY)
  } catch {
    // private windows may refuse storage; the choice still applies to this page
  }
}

/** Whether a quiz should skip its motion: the device asks for less motion, or the setting is on. */
export function quizIsCalm(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'calm'
}
