import 'server-only'
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION ?? 'ap-southeast-1',
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
})

// The apac.* profile is not available for Haiku 4.5; global.* works from ap-southeast-1
const MODEL_IDS = {
  haiku: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
} as const

export type Task =
  | 'fix'
  | 'keywords'
  | 'describe'
  | 'reply'
  | 'try-first'
  | 'lookup'

// Change a task's model here without touching call sites
const ROUTES: Record<Task, keyof typeof MODEL_IDS> = {
  fix: 'haiku',
  keywords: 'haiku',
  describe: 'haiku',
  reply: 'haiku',
  'try-first': 'haiku',
  lookup: 'haiku',
}

export function modelFor(task: Task) {
  const id = MODEL_IDS[ROUTES[task]]
  return { id, model: bedrock(id) }
}

// With `auto`, the global.* profile falls back to the json-tool mode, which Bedrock
// buffers until the end. Native output_config.format streams the object as it is written.
export const streamingObjectOptions = {
  bedrock: { structuredOutputMode: 'outputFormat' },
} as const
