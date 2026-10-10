// Model names that say whether a model reads pictures, for models added by hand to a service of one's own.
// Checked in order: the first rule that matches wins. A relay's "vendor/" prefix is ignored.
const RULES: [RegExp, boolean][] = [
  // Families that never take pictures in, whatever else the name says.
  [/embed|tts|whisper|transcribe|rerank|moderation|qwen-?mt|hy-mt/, false],
  // Names that say so.
  [/vision|(^|[-_.])vl([-_.]|$)|omni|llava|pixtral|internvl|minicpm-v/, true],
  // Known vision families.
  [/claude|gemini|gpt-4o|gpt-4\.1|gpt-5|^o[34]|grok-4|llama-?4/, true],
  [/kimi-k3|kimi-k2\.[5-9]/, true],
  [/minimax-m3/, true],
  [/glm-[\d.]+v|glm-5\.3-flash/, true],
  [/deepseek-v4\.1|^deepseek-flash$/, true],
  [/mimo-v2\.6/, true],
  [/step-5/, true],
  // Known text-only families.
  [/deepseek|^hy\d|hunyuan|minimax-m2|^glm|kimi-k2|^mimo|qwq/, false],
]

/** Whether a model reads pictures, judged from its name; null when the name doesn't say. */
export function guessVision(model: string): boolean | null {
  const name = model.toLowerCase().trim().replace(/^.*\//, '')
  for (const [pattern, vision] of RULES) if (pattern.test(name)) return vision
  return null
}
