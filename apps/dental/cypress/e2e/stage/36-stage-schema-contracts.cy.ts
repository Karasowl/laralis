export {}

describe('Stage database schema contracts', () => {
  it('requires action_logs for Lara action audit trail', () => {
    cy.task('qaAssertStageTable', {
      table: 'action_logs',
      select: 'id',
      migrationHint:
        'Apply supabase/migrations/73_ensure_action_logs_table.sql before treating Lara action persistence as fully covered.',
    }).then((result) => {
      expect(result).to.deep.eq({ table: 'action_logs', readable: true })
    })
  })

  it('requires push notification subscription and tracking tables', () => {
    cy.task('qaAssertStageTable', {
      table: 'push_subscriptions',
      select: 'id, clinic_id, user_id, endpoint, keys_p256dh, keys_auth, is_active',
      migrationHint:
        'Apply supabase/migrations/65_push_notifications.sql before treating browser push subscriptions as covered.',
    }).then((result) => {
      expect(result).to.deep.eq({ table: 'push_subscriptions', readable: true })
    })

    cy.task('qaAssertStageTable', {
      table: 'push_notifications',
      select: 'id, clinic_id, subscription_id, notification_type, status, clicked_at',
      migrationHint:
        'Apply supabase/migrations/65_push_notifications.sql before treating push click tracking as covered.',
    }).then((result) => {
      expect(result).to.deep.eq({ table: 'push_notifications', readable: true })
    })
  })
})
