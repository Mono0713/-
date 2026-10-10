/** A policy page: plain sections of paragraphs and bullet lists. {brand}, {operator} and {email} are filled in when shown. */
export interface LegalDoc {
  title: string
  /** Who runs the site when LEGAL_OPERATOR is not set. */
  operator: string
  intro: string
  sections: { title: string; body: (string | string[])[] }[]
}
