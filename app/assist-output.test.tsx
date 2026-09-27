import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Segment } from '@/lib/assist/highlight'
import type { FixEdit } from '@/lib/assist/schema'

import { CopyHint, EditList, Highlighted } from './assist-output'

describe('CopyHint', () => {
  it('shows the shortcut number by default', () => {
    render(<CopyHint index={0} copied={false} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('Copied')).not.toBeInTheDocument()
  })

  it('shows "Copied" once copied', () => {
    render(<CopyHint index={2} copied={true} />)
    expect(screen.getByText('Copied')).toBeInTheDocument()
  })
})

describe('EditList', () => {
  const edits: FixEdit[] = [
    {
      original: 'goes',
      replacement: 'went',
      type: 'grammar',
      explanation: 'Past tense is needed here.',
    },
  ]

  it('renders one entry per edit with its type and explanation', () => {
    render(<EditList edits={edits} />)
    expect(screen.getByText('Grammar')).toBeInTheDocument()
    expect(screen.getByText('goes')).toBeInTheDocument()
    expect(screen.getByText('went')).toBeInTheDocument()
    expect(screen.getByText('Past tense is needed here.')).toBeInTheDocument()
  })
})

// Tooltip open/close timing belongs to Base UI, not this app, so these tests
// only assert on the DOM structure this component is responsible for.
describe('Highlighted', () => {
  it('renders unchanged text as plain text', () => {
    const segments: Segment[] = [{ kind: 'same', text: 'Hello world' }]
    render(<Highlighted segments={segments} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders removed and added text with strikethrough/insert markup', () => {
    const edit: FixEdit = {
      original: 'goes',
      replacement: 'went',
      type: 'grammar',
      explanation: 'Past tense is needed here.',
    }
    const segments: Segment[] = [
      { kind: 'change', removed: 'goes', added: 'went', edit },
    ]
    const { container } = render(<Highlighted segments={segments} />)

    expect(container.querySelector('del')).toHaveTextContent('goes')
    expect(container.querySelector('ins')).toHaveTextContent('went')
  })

  it('renders a change with no matched edit the same way, just without a tooltip', () => {
    const segments: Segment[] = [
      { kind: 'change', removed: 'goes', added: 'went' },
    ]
    const { container } = render(<Highlighted segments={segments} />)
    expect(container.querySelector('ins')).toHaveTextContent('went')
  })
})
