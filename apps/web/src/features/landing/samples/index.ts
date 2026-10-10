import { biology } from './biology'
import { chemistry } from './chemistry'
import { chinese } from './chinese'
import { economics } from './economics'
import { english } from './english'
import { history } from './history'
import { japanese } from './japanese'
import { math } from './math'
import { physics } from './physics'
import { programming } from './programming'
import type { Sample } from './types'

/** The sample exams the product page shows, one at a time. Adding one: a file here and a line below. */
export const SAMPLES: Sample[] = [math, english, chinese, chemistry, physics, japanese, programming, economics, biology, history]
