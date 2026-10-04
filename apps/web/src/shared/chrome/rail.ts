/** Whether the sidebar is folded into a rail of icons, kept in this browser only. */
export const RAIL_KEY = 'sheetloop-sidebar'

/** Sets data-sidebar on <html> from the saved choice; inlined in <head> so the page never jumps. */
export const RAIL_SCRIPT = `try{if(localStorage.getItem('${RAIL_KEY}')==='rail')document.documentElement.dataset.sidebar='rail'}catch(e){}`

export function toggleRail() {
  const root = document.documentElement
  const rail = root.dataset.sidebar !== 'rail'
  if (rail) root.dataset.sidebar = 'rail'
  else delete root.dataset.sidebar
  try {
    if (rail) localStorage.setItem(RAIL_KEY, 'rail')
    else localStorage.removeItem(RAIL_KEY)
  } catch {
    // private windows may refuse storage; the choice still applies to this page
  }
}
