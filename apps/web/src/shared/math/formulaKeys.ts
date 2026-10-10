import { msg } from '@/shared/i18n/format'

/**
 * The formula editor's keys, by group. `show` is what the key looks like (KaTeX, \square for a
 * slot); `insert` goes in at the cursor, where #0 is the selection and #? an empty slot.
 */
export type FormulaKey = { show: string; insert: string }
export type FormulaGroup = { id: string; label: string; keys: FormulaKey[] }

const sym = (latex: string): FormulaKey => ({ show: latex, insert: latex })

export const FORMULA_GROUPS: FormulaGroup[] = [
  {
    id: 'common',
    label: msg('常用'),
    keys: [
      { show: '\\dfrac{\\square}{\\square}', insert: '\\frac{#0}{#?}' },
      { show: '\\square^{\\square}', insert: '#0^{#?}' },
      { show: '\\square_{\\square}', insert: '#0_{#?}' },
      { show: '\\sqrt{\\square}', insert: '\\sqrt{#0}' },
      { show: '\\sqrt[\\square]{\\square}', insert: '\\sqrt[#?]{#0}' },
      { show: '(\\square)', insert: '\\left(#0\\right)' },
      { show: '|\\square|', insert: '\\left|#0\\right|' },
      sym('\\times'),
      sym('\\div'),
      sym('\\pm'),
      sym('\\ne'),
      sym('\\le'),
      sym('\\ge'),
      sym('\\approx'),
      sym('\\pi'),
      { show: '\\square^{\\circ}', insert: '^{\\circ}' },
      sym('\\longrightarrow'),
      sym('\\infty'),
    ],
  },
  {
    id: 'algebra',
    label: msg('代數'),
    keys: [
      { show: '\\log_{\\square}\\square', insert: '\\log_{#?}#0' },
      { show: '\\ln\\square', insert: '\\ln #0' },
      { show: '\\sin\\square', insert: '\\sin #0' },
      { show: '\\cos\\square', insert: '\\cos #0' },
      { show: '\\tan\\square', insert: '\\tan #0' },
      { show: '\\dbinom{\\square}{\\square}', insert: '\\binom{#0}{#?}' },
      { show: '\\begin{cases}\\square\\\\\\square\\end{cases}', insert: '\\begin{cases}#0\\\\#?\\end{cases}' },
      { show: '\\begin{pmatrix}\\square&\\square\\\\\\square&\\square\\end{pmatrix}', insert: '\\begin{pmatrix}#0&#?\\\\#?&#?\\end{pmatrix}' },
      { show: 'f(\\square)', insert: 'f\\left(#0\\right)' },
      sym('\\cdot'),
      sym('\\in'),
      sym('\\notin'),
      sym('\\subset'),
      sym('\\cup'),
      sym('\\cap'),
      sym('\\varnothing'),
      sym('\\Rightarrow'),
      sym('\\Leftrightarrow'),
    ],
  },
  {
    id: 'geometry',
    label: msg('幾何'),
    keys: [
      { show: '\\angle\\square', insert: '\\angle #0' },
      { show: '\\triangle\\square', insert: '\\triangle #0' },
      { show: '\\overline{\\square}', insert: '\\overline{#0}' },
      { show: '\\overrightarrow{\\square}', insert: '\\overrightarrow{#0}' },
      { show: '\\vec{\\square}', insert: '\\vec{#0}' },
      { show: '\\overset{\\frown}{\\square}', insert: '\\overset{\\frown}{#0}' },
      sym('\\perp'),
      sym('\\parallel'),
      sym('\\cong'),
      sym('\\sim'),
      sym('\\odot'),
      sym('\\therefore'),
      sym('\\because'),
      { show: '\\square^{\\circ}', insert: '^{\\circ}' },
    ],
  },
  {
    id: 'calculus',
    label: msg('微積分'),
    keys: [
      { show: '\\lim_{\\square\\to\\square}', insert: '\\lim_{#?\\to #?}' },
      { show: '\\int\\square\\,dx', insert: '\\int #0\\,d#?' },
      { show: '\\int_{\\square}^{\\square}', insert: '\\int_{#?}^{#?}#0\\,d#?' },
      { show: '\\sum_{\\square}^{\\square}', insert: '\\sum_{#?}^{#?}' },
      { show: '\\prod_{\\square}^{\\square}', insert: '\\prod_{#?}^{#?}' },
      { show: '\\frac{d}{dx}', insert: '\\frac{d}{d#?}' },
      { show: '\\frac{\\partial}{\\partial x}', insert: '\\frac{\\partial}{\\partial #?}' },
      { show: "\\square'", insert: "#0'" },
      sym('\\Delta'),
      sym('\\nabla'),
      sym('\\infty'),
      sym('\\to'),
    ],
  },
  {
    id: 'greek',
    label: msg('希臘字母'),
    keys: ['alpha', 'beta', 'gamma', 'delta', 'varepsilon', 'theta', 'lambda', 'mu', 'pi', 'rho', 'sigma', 'tau', 'varphi', 'omega', 'Delta', 'Sigma', 'Omega'].map((name) => sym(`\\${name}`)),
  },
  {
    id: 'chemistry',
    label: msg('化學'),
    keys: [
      { show: '\\ce{H2O}', insert: '\\ce{#0}' },
      { show: '\\square_{\\square}', insert: '#0_{#?}' },
      { show: '\\square^{\\square}', insert: '#0^{#?}' },
      { show: '\\ce{->}', insert: '\\longrightarrow' },
      { show: '\\ce{<=>}', insert: '\\rightleftharpoons' },
      { show: '\\xrightarrow{\\square}', insert: '\\xrightarrow{#?}' },
      sym('\\uparrow'),
      sym('\\downarrow'),
      sym('\\Delta'),
      sym('\\cdot'),
      { show: '\\square^{+}', insert: '^{+}' },
      { show: '\\square^{-}', insert: '^{-}' },
      { show: '\\square^{2+}', insert: '^{2+}' },
      { show: '\\square^{2-}', insert: '^{2-}' },
    ],
  },
]
