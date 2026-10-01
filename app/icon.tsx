import { ImageResponse } from 'next/og'

import { LOGO_STROKE } from '@/components/logo'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#5b3fd0',
        borderRadius: 8,
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32">
        <path
          d={LOGO_STROKE}
          fill="none"
          stroke="#ffffff"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    { ...size },
  )
}
