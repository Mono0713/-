# @exam/models

The model layer as data: which models exist, what they cost, and which one each task uses.
It calls no API and has no dependencies, so the server and the browser use the same rules.

## Pieces

| File | What it holds |
| --- | --- |
| `catalog.ts` | `BUILTIN_MODELS`: the known models of Claude, OpenAI and Gemini with a tier (`fast`, `balanced`, `best`), whether they read images, and an approximate list price (USD per million tokens). `ProviderInfo` is a service with its models and whether it has a key; services people add are turned into the same shape by the web app. |
| `routing.ts` | `PLAN`: the tier each task uses at each strength (`save`, `balanced`, `best`), and for recognition the tier doubtful pages are read again with. `route()` turns a task, a strength and the person's services into a `Route`: the primary model, fallbacks on the other services, and the escalation model. |
| `cost.ts` | `TYPICAL` tokens per unit of each task, `unitCost()` and `routeCost()` for estimates, `formatUsd()`. |

## Rules

- Tasks: `recognition` (exam pages), `handwriting` (handwritten answers), `grading` (marking open answers), `tutoring` (問 AI), `translation`, `solving` (AI 作答: a key the paper left out) and `explaining` (AI 詳解). Reading tasks only use models that read images.
- Without an override, the cheapest service at the task's tier goes first; the others follow as fallbacks in price order. A service lacking that tier uses its nearest one, the more capable on a tie.
- A model picked by hand for a task wins while its service has a key. It does not escalate, and it still has the other services as fallbacks.
- `PICTURE_TASKS` (AI 作答, 詳解, 問 AI) send a question's pictures when it has any. Such a request is routed with `pictures: true`: only models that see qualify, and a hand-picked model that cannot see is passed over (a model typed in by hand that the list does not know is trusted to see). The web app keeps a separate hand-picked model for these requests (`pictureModels`).
- The strength is a preset: the settings page's 一鍵套用 sets it and drops the hand-picked models, so every task follows it again.
- Unknown prices rank last and make estimates say "unknown" rather than guess.
- Changing a model, a price or the plan is a change to these tables only. Prices are estimates, not billing.

## Used by

- `@exam/extraction` builds its model pickers from `BUILTIN_MODELS`.
- `@exam/settings` stores the strength, the hand-picked models (`taskModels`, and `pictureModels` for questions with pictures), and added services.
- `@exam/usage` prices logged calls with `unitCost()`.
- `apps/web/src/server/context.ts` routes imports (`AUTO`) and the AI teacher; the settings page shows routes and estimates with the same functions.
