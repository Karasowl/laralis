'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'

type Numeric = number | ''

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: Numeric
  onChange: (value: Numeric) => void
  min?: number
  max?: number
  step?: number | string
  selectOnFocus?: boolean
}

export function NumericInput({ value, onChange, min, max, step, selectOnFocus = true, ...rest }: NumericInputProps) {
  return (
    <Input
      type="number"
      value={value === '' ? '' : value}
      min={min}
      max={max}
      step={step}
      onFocus={e => { if (selectOnFocus) try { e.currentTarget.select() } catch {} }}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') { onChange(''); return }
        const n = Number(raw)
        if (Number.isNaN(n)) return
        let v = n
        if (typeof min === 'number') v = Math.max(min, v)
        if (typeof max === 'number') v = Math.min(max, v)
        onChange(v)
      }}
      {...rest}
    />
  )
}

