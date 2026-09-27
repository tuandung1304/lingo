import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssistRequest, FixResult } from '@/lib/assist/schema'

// The real `useObject` streams over the network. For interaction tests we
// swap it for a fake that still uses React state internally (so `submit`
// triggers a real re-render), but resolves instantly and under test control
// instead of hitting `/api/assist`.
const { submitCalls, nextResult, stopSpy } = vi.hoisted(() => ({
  submitCalls: [] as unknown[],
  nextResult: { current: null as FixResult | null },
  stopSpy: vi.fn(),
}))

vi.mock('@ai-sdk/react', () => ({
  useObject: () => {
    const [state, setState] = useState<{
      object?: FixResult
      isLoading: boolean
    }>({ isLoading: false })

    return {
      object: state.object,
      isLoading: state.isLoading,
      error: undefined,
      stop: () => {
        stopSpy()
        setState((s) => ({ ...s, isLoading: false }))
      },
      submit: (input: unknown) => {
        submitCalls.push(input)
        setState({ isLoading: true, object: undefined })
        if (nextResult.current) {
          const result = nextResult.current
          queueMicrotask(() => setState({ isLoading: false, object: result }))
        }
      },
    }
  },
}))

import { Assist } from './assist'

const FIX_RESULT: FixResult = {
  corrected: 'I go to school every day.',
  alternatives: ['I head to school daily.'],
  edits: [
    {
      original: 'goes',
      replacement: 'go',
      type: 'grammar',
      explanation: 'Present simple, not third person.',
    },
  ],
}

beforeEach(() => {
  submitCalls.length = 0
  nextResult.current = null
  stopSpy.mockClear()
  localStorage.clear()
})

async function submitSentence(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  await user.click(screen.getByLabelText('Sentence to fix'))
  await user.type(screen.getByLabelText('Sentence to fix'), text)
  await user.keyboard('{Control>}{Enter}{/Control}')
}

describe('Assist', () => {
  it('disables the Fix button until there is input', () => {
    render(<Assist />)
    expect(screen.getByRole('button', { name: /fix/i })).toBeDisabled()
  })

  it('submits the trimmed input with the selected mode and tone on Ctrl+Enter', async () => {
    const user = userEvent.setup()
    render(<Assist />)

    await submitSentence(user, '  he goes school  ')

    expect(submitCalls).toEqual<AssistRequest[]>([
      { mode: 'fix', input: 'he goes school', tone: 'casual' },
    ])
  })

  it('remembers the selected tone across submits via localStorage', async () => {
    const user = userEvent.setup()
    render(<Assist />)

    await user.click(screen.getByRole('button', { name: 'polite' }))
    await submitSentence(user, 'hello')

    expect(submitCalls).toEqual([
      { mode: 'fix', input: 'hello', tone: 'polite' },
    ])
    expect(localStorage.getItem('assist.tone')).toBe('polite')
  })

  it('shows a skeleton while loading and then the corrected sentence', async () => {
    nextResult.current = FIX_RESULT
    const user = userEvent.setup()
    const { container } = render(<Assist />)

    await submitSentence(user, 'he goes school')

    // The corrected sentence is split across <ins>/<del>/<span> nodes by the
    // word-diff highlighting, so it can't be matched as one text node -
    // asserting on the rendered section's full text is more robust here.
    const corrected = await screen.findByText('I head to school daily.')
    expect(corrected).toBeInTheDocument()
    expect(container).toHaveTextContent('I go to school every day.')
    expect(container).toHaveTextContent('Present simple, not third person.')
  })

  it('shows "Looks good" when the corrected sentence matches the input exactly', async () => {
    nextResult.current = {
      corrected: 'This is fine.',
      alternatives: [],
      edits: [],
    }
    const user = userEvent.setup()
    render(<Assist />)

    await submitSentence(user, 'This is fine.')

    expect(await screen.findByText('Looks good')).toBeInTheDocument()
  })

  it('copies the corrected sentence to the clipboard on "1"', async () => {
    nextResult.current = FIX_RESULT
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const user = userEvent.setup()
    render(<Assist />)

    await submitSentence(user, 'he goes school')
    // Wait for the "done" state via a plain (non-diffed) piece of text
    await screen.findByText('I head to school daily.')

    await user.keyboard('1')

    expect(writeText).toHaveBeenCalledWith('I go to school every day.')
  })

  it('stops the request on Escape while loading', async () => {
    const user = userEvent.setup()
    render(<Assist />)

    await submitSentence(user, 'he goes school')
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(stopSpy).toHaveBeenCalledOnce()
  })
})
