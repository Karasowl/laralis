import { describe, expect, it } from 'vitest'
import { ConversationContextManager } from '@/lib/ai/context'

describe('Lara conversation context contract', () => {
  it('keeps service focus, pronoun references, topic, and time period pinned', () => {
    const manager = new ConversationContextManager('session-qa', 'clinic-qa')

    manager.processUserMessage('Analiza el servicio "Limpieza QA" este mes', 0)
    manager.processAssistantMessage('Limpieza QA mantiene buen margen este mes.', 1)
    manager.processUserMessage('Y su margen?', 2)

    const context = manager.getContext()

    expect(context.focus.primaryEntity).toMatchObject({
      type: 'service',
      name: 'Limpieza QA',
      firstMentioned: 0,
      lastReferenced: 2,
    })
    expect(context.focus.primaryEntity?.referenceCount).toBeGreaterThanOrEqual(2)
    expect(context.focus.currentTopic).toBe('profitability')
    expect(context.focus.timePeriod).toMatchObject({
      type: 'month',
      label: 'este mes',
    })

    const prompt = manager.generateContextPrompt()
    expect(prompt).toContain('**Current Focus**: service "Limpieza QA"')
    expect(prompt).toContain('**Time context**: este mes')
    expect(prompt).toContain('**Current topic**: profitability')
    expect(prompt).toContain('When user says "it", "this", "that", "su", "ese", "esta"')
  })

  it('does not lose repeated time references because of global RegExp state', () => {
    const manager = new ConversationContextManager('session-qa', 'clinic-qa')

    manager.processUserMessage('Analiza el servicio "Limpieza QA" este mes', 0)
    expect(manager.getContext().focus.timePeriod?.label).toBe('este mes')

    manager.processUserMessage('Compara con el servicio "Blanqueamiento QA" este mes', 1)
    expect(manager.getContext().focus.timePeriod?.label).toBe('este mes')
    expect(manager.getContext().focus.primaryEntity).toMatchObject({
      type: 'service',
      name: 'Blanqueamiento QA',
    })
    expect(manager.getContext().focus.secondaryEntities[0]).toMatchObject({
      type: 'service',
      name: 'Limpieza QA',
    })
  })

  it('tracks suggested actions until they are executed', () => {
    const manager = new ConversationContextManager('session-qa', 'clinic-qa')

    manager.processAssistantMessage('Puedo ajustar tu configuracion de tiempo.', 0, {
      type: 'update_time_settings',
      params: {
        work_days: 25,
        hours_per_day: 7,
        real_productivity_pct: 82,
      },
      suggestedAt: '2026-05-06T00:00:00.000Z',
      status: 'suggested',
    })

    expect(manager.getContext().actions).toHaveLength(1)
    expect(manager.generateContextPrompt()).toContain(
      '**Pending suggested actions**: update_time_settings'
    )

    manager.recordActionExecuted('update_time_settings', {
      success: true,
    })

    expect(manager.getContext().actions[0]).toMatchObject({
      type: 'update_time_settings',
      status: 'executed',
      result: {
        success: true,
      },
    })
    expect(manager.generateContextPrompt()).not.toContain('**Pending suggested actions**')
  })
})
