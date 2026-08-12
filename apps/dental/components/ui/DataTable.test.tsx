import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataTable } from './DataTable'

describe('DataTable sticky actions', () => {
  it('keeps the desktop actions column pinned while preserving mobile actions', () => {
    const actions = {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      sticky: 'right' as const,
      render: () => <button type="button">Edit treatment</button>,
    }

    render(
      <DataTable
        data={[{ id: 'treatment-1', patient: 'Test patient' }]}
        columns={[
          { key: 'patient', label: 'Patient' },
          actions,
        ]}
        mobileColumns={[
          { key: 'patient', label: 'Patient' },
          actions,
        ]}
      />
    )

    const actionsHeader = screen.getByRole('columnheader', { name: 'Actions' })
    expect(actionsHeader.classList.contains('sticky')).toBe(true)
    expect(actionsHeader.classList.contains('right-0')).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Edit treatment' })).toHaveLength(2)
  })
})
