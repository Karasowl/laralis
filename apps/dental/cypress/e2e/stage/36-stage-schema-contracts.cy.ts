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
})
