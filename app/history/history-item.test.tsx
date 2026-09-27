import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { FixResult, SuggestResult } from '@/lib/assist/schema'

import { HistoryItem } from './history-item'

const OUTPUT: FixResult = {
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

function renderItem(output = OUTPUT, input = 'I goes to school every day.') {
  return render(
    <HistoryItem
      id="s1"
      mode="fix"
      input={input}
      tone="casual"
      output={output}
      createdAt={new Date('2026-09-27T10:00:00Z')}
    />,
  )
}

describe('HistoryItem', () => {
  it('copies the corrected sentence', async () => {
    // setup() installs its own clipboard stub, so spy on it afterwards
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    renderItem()

    await user.click(
      screen.getByRole('button', { name: 'Copy corrected sentence' }),
    )

    expect(writeText).toHaveBeenCalledWith('I go to school every day.')
  })

  it('opens the session on the Assist page', () => {
    renderItem()

    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      '/?session=s1',
    )
  })

  it('shows the original input above a rewrite with no edits', () => {
    renderItem(
      { corrected: 'I am hungry.', alternatives: [], edits: [] },
      'tôi đói',
    )

    expect(screen.getByText('tôi đói')).toBeInTheDocument()
    expect(screen.getByText('I am hungry.')).toBeInTheDocument()
  })

  it('summarizes alternatives and edits instead of listing them', () => {
    renderItem()

    expect(screen.getByText('1 alternative')).toBeInTheDocument()
    expect(screen.getByText('1 edit')).toBeInTheDocument()
    expect(
      screen.queryByText('I head to school daily.'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Present simple, not third person.'),
    ).not.toBeInTheDocument()
  })
})

describe('HistoryItem (suggest)', () => {
  const SUGGEST: SuggestResult = {
    suggestions: ['The server was lagging like crazy.', 'Huge lag last night.'],
    vocab: [{ phrase: 'like crazy', meaning: 'Rất nhiều, dữ dội.' }],
  }

  function renderSuggest() {
    return render(
      <HistoryItem
        id="s2"
        mode="suggest"
        input="hôm qua server lag"
        tone="casual"
        output={SUGGEST}
        createdAt={new Date('2026-09-27T10:00:00Z')}
      />,
    )
  }

  it('shows the input, the first suggestion and a summary', () => {
    const { container } = renderSuggest()

    expect(screen.getByText('hôm qua server lag')).toBeInTheDocument()
    expect(container).toHaveTextContent('The server was lagging like crazy.')
    expect(screen.getByText('Suggest')).toBeInTheDocument()
    expect(screen.getByText('2 suggestions')).toBeInTheDocument()
    expect(screen.getByText('1 phrase')).toBeInTheDocument()
    expect(screen.queryByText('Huge lag last night.')).not.toBeInTheDocument()
  })

  it('copies the first suggestion', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    renderSuggest()

    await user.click(
      screen.getByRole('button', { name: 'Copy first suggestion' }),
    )

    expect(writeText).toHaveBeenCalledWith('The server was lagging like crazy.')
  })
})
