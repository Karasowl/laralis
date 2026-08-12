import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentDialog } from './PaymentDialog'

describe('PaymentDialog', () => {
  it('opens with the full outstanding balance ready to confirm', async () => {
    render(
      <PaymentDialog
        open
        onOpenChange={vi.fn()}
        treatment={{
          id: 'treatment-1',
          price_cents: 10000,
          amount_paid_cents: 7500,
          pending_balance_cents: 2500,
        }}
        onSubmit={vi.fn(async () => true)}
      />
    )

    const amountInput = screen.getByLabelText('paymentAmount') as HTMLInputElement
    await waitFor(() => expect(amountInput.value).toBe('25'))
    const submitButton = screen.getByRole('button', { name: 'registerPayment' }) as HTMLButtonElement
    expect(submitButton.disabled).toBe(false)
  })
})
