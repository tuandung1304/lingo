import { generateText } from 'ai'

import { modelFor } from '@/lib/ai/models'
import { getCurrentUser } from '@/lib/auth'

// Phase 0 smoke test: verifies auth + Bedrock end to end
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, model } = modelFor('fix')
  const start = Date.now()
  const { text } = await generateText({
    model,
    prompt:
      'Fix this sentence and reply with only the corrected sentence: "i go to school yesterday"',
  })

  return Response.json({ model: id, latencyMs: Date.now() - start, text })
}
