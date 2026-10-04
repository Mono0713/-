/** Words in a typed answer: each Chinese, Japanese or Korean character counts as one, like 字數 on a 稿紙. */
export function wordCount(text: string): number {
  const cjk = text.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/g)?.length ?? 0
  const words = text.replace(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/g, ' ').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0
  return cjk + words
}
