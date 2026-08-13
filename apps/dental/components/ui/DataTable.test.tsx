import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'

describe('DataTable sticky actions', () => {
  it('keeps the desktop actions column pinned without mounting the hidden mobile copy', () => {
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
    expect(screen.getAllByRole('button', { name: 'Edit treatment' })).toHaveLength(1)
  })

  it('mounts only one bounded page and navigates through the full collection', () => {
    const data = Array.from({ length: 120 }, (_, index) => ({
      id: `treatment-${index + 1}`,
      patient: `Patient ${index + 1}`,
    }))

    render(
      <DataTable
        data={data}
        columns={[{ key: 'patient', label: 'Patient' }]}
        pageSize={25}
        showCount
      />
    )

    expect(screen.getByText('Patient 1')).not.toBeNull()
    expect(screen.getByText('Patient 25')).not.toBeNull()
    expect(screen.queryByText('Patient 26')).toBeNull()
    expect(screen.getByText('1 / 5')).not.toBeNull()
    expect(document.querySelectorAll('tbody tr')).toHaveLength(25)

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    expect(screen.queryByText('Patient 1')).toBeNull()
    expect(screen.getByText('Patient 26')).not.toBeNull()
    expect(screen.getByText('2 / 5')).not.toBeNull()
    expect(document.querySelectorAll('tbody tr')).toHaveLength(25)
  })

  it('switches to the mobile cards without retaining the desktop rows', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })

    render(
      <DataTable
        data={[{ id: 'treatment-mobile', patient: 'Mobile patient' }]}
        columns={[{ key: 'patient', label: 'Patient' }]}
        mobileColumns={[{ key: 'patient', label: 'Patient' }]}
      />
    )

    await waitFor(() => expect(screen.getByText('Mobile patient')).not.toBeNull())
    expect(document.querySelectorAll('tbody tr')).toHaveLength(0)
    expect(screen.getAllByText('Mobile patient')).toHaveLength(1)
  })

  it('delegates page changes when the server owns pagination', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    const onPageChange = vi.fn()
    render(
      <DataTable
        data={[{ id: 'treatment-51', patient: 'Patient 51' }]}
        columns={[{ key: 'patient', label: 'Patient' }]}
        showCount
        serverPagination={{
          pageIndex: 1,
          pageCount: 10,
          totalCount: 475,
          onPageChange,
        }}
      />
    )

    expect(screen.getByText('475')).not.toBeNull()
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('reserves the mobile floating-assistant area beside pagination', () => {
    render(
      <DataTable
        data={Array.from({ length: 2 }, (_, index) => ({
          id: `treatment-${index + 1}`,
          patient: `Patient ${index + 1}`,
        }))}
        columns={[{ key: 'patient', label: 'Patient' }]}
        pageSize={1}
      />
    )

    const pagination = screen.getByTestId('data-table-pagination')
    expect(pagination.classList.contains('pr-24')).toBe(true)
    expect(pagination.classList.contains('sm:pr-4')).toBe(true)
  })
})
