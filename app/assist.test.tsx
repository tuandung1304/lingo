import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AssistRequest,
  AssistResult,
  FixResult,
  SuggestResult,
} from '@/lib/assist/schema'

// The real `useObject` streams over the network. For interaction tests we
// swap it for a fake that still uses React state internally (so `submit`
// triggers a real re-render), but resolves instantly and under test control
// instead of hitting `/api/assist`.
const { submitCalls, nextResult, stopSpy } = vi.hoisted(() => ({
  submitCalls: [] as unknown[],
  nextResult: { current: null as AssistResult | null },
  stopSpy: vi.fn(),
}))

vi.mock('@ai-sdk/react', () => ({
  useObject: ({ initialValue }: { initialValue?: AssistResult }) => {
    const [state, setState] = useState<{
      object?: AssistResult
      isLoading: boolean
    }>({ isLoading: false, object: initialValue })

    return {
      object: state.object,
      isLoading: state.isLoading,
      error: undefined,
      stop: () => {
        stopSpy()
        setState((s) => ({ ...s, isLoading: false }))
      },
      clear: () => setState({ isLoading: false, object: undefined }),
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

async function describeIdea(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) {
  await user.type(screen.getByLabelText('What you want to say'), text)
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

    // The red-pen marks split the corrected sentence across <del>/<ruby> nodes;
    // the plain copy kept for screen readers is what reads as one sentence.
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

  it('regenerates the submitted sentence with fresh on "r"', async () => {
    nextResult.current = FIX_RESULT
    const user = userEvent.setup()
    render(<Assist />)
    await submitSentence(user, 'he goes school')
    await screen.findByText('I head to school daily.')

    await user.keyboard('r')

    expect(submitCalls).toHaveLength(2)
    expect(submitCalls[1]).toMatchObject({
      input: 'he goes school',
      fresh: true,
    })
  })

  it('regenerates from the button with the current tone', async () => {
    nextResult.current = FIX_RESULT
    const user = userEvent.setup()
    render(<Assist />)
    await submitSentence(user, 'he goes school')
    await screen.findByText('I head to school daily.')

    await user.click(screen.getByRole('button', { name: 'polite' }))
    await user.click(screen.getByRole('button', { name: 'Regenerate' }))

    expect(submitCalls.at(-1)).toEqual<AssistRequest>({
      mode: 'fix',
      input: 'he goes school',
      tone: 'polite',
      fresh: true,
    })
  })

  it('does not regenerate on "r" while typing', async () => {
    nextResult.current = FIX_RESULT
    const user = userEvent.setup()
    render(<Assist />)
    await submitSentence(user, 'he goes school')
    await screen.findByText('I head to school daily.')

    await user.click(screen.getByLabelText('Sentence to fix'))
    await user.keyboard('r')

    expect(submitCalls).toHaveLength(1)
  })

  describe('with an opened session', () => {
    const SESSION = {
      mode: 'fix' as const,
      input: 'I goes to school every day.',
      tone: 'polite' as const,
      output: FIX_RESULT,
      createdAt: new Date('2026-09-27T10:00:00Z'),
    }

    it('shows the saved input, tone and result without submitting', () => {
      const { container } = render(<Assist session={SESSION} />)

      expect(screen.getByLabelText('Sentence to fix')).toHaveValue(
        SESSION.input,
      )
      expect(screen.getByRole('button', { name: 'polite' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(screen.getByText('I head to school daily.')).toBeInTheDocument()
      expect(container).toHaveTextContent('Present simple, not third person.')
      expect(screen.getByText(/^Saved/)).toBeInTheDocument()
      expect(submitCalls).toHaveLength(0)
    })

    it('does not overwrite the saved tone preference', () => {
      localStorage.setItem('assist.tone', 'casual')

      render(<Assist session={SESSION} />)

      expect(localStorage.getItem('assist.tone')).toBe('casual')
    })

    it('regenerates the session input and drops ?session= from the URL', async () => {
      window.history.replaceState(null, '', '/?session=s1')
      const user = userEvent.setup()
      render(<Assist session={SESSION} />)

      await user.keyboard('r')

      expect(submitCalls.at(-1)).toEqual<AssistRequest>({
        mode: 'fix',
        input: SESSION.input,
        tone: 'polite',
        fresh: true,
      })
      expect(window.location.search).toBe('')
      expect(screen.queryByText(/^Saved/)).not.toBeInTheDocument()
    })
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

  describe('suggest mode', () => {
    const SUGGEST_RESULT: SuggestResult = {
      suggestions: [
        'The server was lagging like crazy yesterday.',
        'Yesterday the server lag was brutal.',
      ],
      vocab: [{ phrase: 'like crazy', meaning: 'Rất nhiều, dữ dội.' }],
    }

    it('switches to Suggest from its tab and submits with that mode', async () => {
      const user = userEvent.setup()
      render(<Assist />)

      await user.click(screen.getByRole('tab', { name: 'Suggest' }))
      await describeIdea(user, 'hôm qua server lag')

      expect(submitCalls).toEqual<AssistRequest[]>([
        { mode: 'suggest', input: 'hôm qua server lag', tone: 'casual' },
      ])
      expect(localStorage.getItem('assist.mode')).toBe('suggest')
    })

    it('cycles modes with Tab when nothing is focused', async () => {
      const user = userEvent.setup()
      render(<Assist />)
      await user.keyboard('{Escape}')

      await user.keyboard('{Tab}')

      expect(screen.getByRole('tab', { name: 'Suggest' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })

    it('cycles modes with Tab while typing, keeping focus in the box', async () => {
      const user = userEvent.setup()
      render(<Assist />)
      await user.type(screen.getByLabelText('Sentence to fix'), 'hello')

      await user.keyboard('{Tab}')

      expect(screen.getByRole('tab', { name: 'Suggest' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      const box = screen.getByLabelText('What you want to say')
      expect(box).toHaveFocus()
      expect(box).toHaveValue('hello')

      await user.keyboard('{Shift>}{Tab}{/Shift}')
      expect(screen.getByRole('tab', { name: 'Fix' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })

    it('keeps the typed input but clears the result when switching modes', async () => {
      nextResult.current = FIX_RESULT
      const user = userEvent.setup()
      render(<Assist />)
      await submitSentence(user, 'he goes school')
      await screen.findByText('I head to school daily.')

      await user.click(screen.getByRole('tab', { name: 'Suggest' }))

      expect(screen.getByLabelText('What you want to say')).toHaveValue(
        'he goes school',
      )
      expect(
        screen.queryByText('I head to school daily.'),
      ).not.toBeInTheDocument()
    })

    it('shows the suggestions and explains the vocab', async () => {
      nextResult.current = SUGGEST_RESULT
      const user = userEvent.setup()
      render(<Assist />)
      await user.click(screen.getByRole('tab', { name: 'Suggest' }))

      await describeIdea(user, 'hôm qua server lag')

      expect(
        await screen.findByText('Yesterday the server lag was brutal.'),
      ).toBeInTheDocument()
      expect(screen.getByText('Rất nhiều, dữ dội.')).toBeInTheDocument()
    })

    it('copies the second suggestion on "2"', async () => {
      nextResult.current = SUGGEST_RESULT
      const writeText = vi.spyOn(navigator.clipboard, 'writeText')
      const user = userEvent.setup()
      render(<Assist />)
      await user.click(screen.getByRole('tab', { name: 'Suggest' }))
      await describeIdea(user, 'hôm qua server lag')
      await screen.findByText('Yesterday the server lag was brutal.')

      await user.keyboard('2')

      expect(writeText).toHaveBeenCalledWith(
        'Yesterday the server lag was brutal.',
      )
    })

    it('copies only from the copy button, not by clicking the sentence', async () => {
      nextResult.current = SUGGEST_RESULT
      const writeText = vi.spyOn(navigator.clipboard, 'writeText')
      const user = userEvent.setup()
      render(<Assist />)
      await user.click(screen.getByRole('tab', { name: 'Suggest' }))
      await describeIdea(user, 'hôm qua server lag')
      const sentence = await screen.findByText(
        'Yesterday the server lag was brutal.',
      )

      await user.click(sentence)
      expect(writeText).not.toHaveBeenCalled()

      await user.click(
        screen.getByRole('button', { name: 'Copy suggestion 2' }),
      )
      expect(writeText).toHaveBeenCalledWith(
        'Yesterday the server lag was brutal.',
      )
    })

    it('opens a saved suggest session in Suggest mode', () => {
      localStorage.setItem('assist.mode', 'fix')

      render(
        <Assist
          session={{
            mode: 'suggest',
            input: 'hôm qua server lag',
            tone: 'casual',
            output: SUGGEST_RESULT,
            createdAt: new Date('2026-09-27T10:00:00Z'),
          }}
        />,
      )

      expect(screen.getByRole('tab', { name: 'Suggest' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(
        screen.getByText('Yesterday the server lag was brutal.'),
      ).toBeInTheDocument()
      expect(localStorage.getItem('assist.mode')).toBe('fix')
    })
  })
})
