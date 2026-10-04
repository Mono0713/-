/**
 * Product identity. Renaming the product means editing this file and, if the
 * mark changes, LogoMark.tsx. Nothing else in the app spells the name.
 */
export const BRAND = {
  name: 'Sheetloop',
  /** Local names shown next to the wordmark, by UI locale. */
  localNames: { 'zh-Hant': '卷環' } as Record<string, string>, // i18n-ignore
  taglines: {
    'zh-Hant': '紙本考卷進來，反覆練習的題庫出去', // i18n-ignore
    en: 'Paper in, practice loop out.',
  } as Record<string, string>,
}

export const brandTagline = (locale = 'zh-Hant') => BRAND.taglines[locale] ?? BRAND.taglines.en!
export const brandLocalName = (locale = 'zh-Hant') => BRAND.localNames[locale] ?? null
