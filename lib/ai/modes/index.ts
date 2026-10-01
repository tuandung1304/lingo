import 'server-only'
import type { z } from 'zod'

import type { Task } from '@/lib/ai/models'
import {
  type AssistResult,
  fixResultSchema,
  type Mode,
  suggestResultSchema,
  type Tone,
  writeResultSchema,
} from '@/lib/assist/schema'

import { fixSystemPrompt } from './fix'
import { suggestSystemPrompt } from './suggest'
import { writeSystemPrompt } from './write'

export interface ModeConfig {
  task: Task
  instructions: (tone: Tone) => string
  schema: z.ZodType<AssistResult>
  temperature: number
}

export const MODE_CONFIG: Record<Mode, ModeConfig> = {
  fix: {
    task: 'fix',
    instructions: fixSystemPrompt,
    schema: fixResultSchema,
    temperature: 0.3,
  },
  suggest: {
    task: 'suggest',
    instructions: suggestSystemPrompt,
    schema: suggestResultSchema,
    temperature: 0.6,
  },
  write: {
    task: 'write',
    instructions: writeSystemPrompt,
    schema: writeResultSchema,
    temperature: 0.7,
  },
}
