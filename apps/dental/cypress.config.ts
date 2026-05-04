import { defineConfig } from 'cypress';
import { createClient } from '@supabase/supabase-js';

const baseUrl =
  process.env.CYPRESS_BASE_URL ||
  process.env.CYPRESS_baseUrl ||
  'http://localhost:3000'

export default defineConfig({
  e2e: {
    baseUrl,
    viewportWidth: 1280,
    viewportHeight: 720,
    video: process.env.CYPRESS_VIDEO !== 'false',
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    
    setupNodeEvents(on, config) {
      if (process.env.CYPRESS_COVERAGE === 'true') {
        require('@cypress/code-coverage/task')(on, config);
      }

      const envValue = (...names: string[]) => {
        for (const name of names) {
          const value = process.env[name] || config.env?.[name];
          if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
          }
        }
        return '';
      };

      const stageUrl = envValue('CYPRESS_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
      const serviceRoleKey = envValue('CYPRESS_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');

      const adminClient = () => {
        if (!stageUrl.includes('kafbqdliromcveojtdar')) {
          throw new Error('QA Supabase tasks are stage-only and require CYPRESS_SUPABASE_URL for kafbqdliromcveojtdar');
        }

        if (!serviceRoleKey) {
          throw new Error('Missing CYPRESS_SUPABASE_SERVICE_ROLE_KEY for QA Supabase tasks');
        }

        return createClient(stageUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      };

      const findAuthUserByEmail = async (email: string) => {
        const client = adminClient();
        let page = 1;

        while (page < 25) {
          const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
          if (error) throw new Error(`Could not list auth users: ${error.message}`);

          const user = data.users.find((row) => row.email?.toLowerCase() === email.toLowerCase());
          if (user) return user;
          if (data.users.length < 1000) return null;
          page += 1;
        }

        return null;
      };

      const deleteOwnedWorkspaceTree = async (userId: string) => {
        const client = adminClient();
        const { data: workspaces, error } = await client
          .from('workspaces')
          .select('id')
          .eq('owner_id', userId);

        if (error) throw new Error(`Could not list owned workspaces: ${error.message}`);

        const workspaceIds = (workspaces || []).map((workspace) => workspace.id).filter(Boolean);
        if (workspaceIds.length === 0) return;

        await client.from('workspace_users').delete().in('workspace_id', workspaceIds);
        await client.from('workspace_members').delete().in('workspace_id', workspaceIds);
        await client.from('clinics').delete().in('workspace_id', workspaceIds);
        await client.from('workspaces').delete().in('id', workspaceIds);
      };

      const deleteUserMembershipsAndInvitations = async (email: string, userId?: string) => {
        const client = adminClient();

        await client.from('invitations').delete().eq('email', email);

        if (!userId) return;

        await client.from('clinic_users').delete().eq('user_id', userId);
        await client.from('workspace_users').delete().eq('user_id', userId);
        await client.from('workspace_members').delete().eq('user_id', userId);
        await client.from('user_profiles').delete().eq('id', userId);
        await client.from('profiles').delete().eq('id', userId);
      };

      const civilDate = (offsetDays: number) => {
        const date = new Date();
        date.setDate(date.getDate() + offsetDays);
        return date.toISOString().slice(0, 10);
      };

      const disabledNotificationSettings = () => ({
        email_enabled: false,
        confirmation_enabled: false,
        reminder_enabled: false,
        reminder_hours_before: 24,
        sender_name: 'Laralis QA',
        reply_to_email: null,
        sms: { enabled: false },
        whatsapp: { enabled: false },
      });

      const cronNotificationSettings = () => ({
        ...disabledNotificationSettings(),
        email_enabled: true,
        reminder_enabled: true,
        sms: {
          enabled: false,
          default_country_code: '1',
          patient: {
            reminder_24h: false,
            reminder_2h: false,
          },
          staff: {
            enabled: false,
            reminder_24h: false,
            reminder_2h: false,
          },
        },
        whatsapp: {
          enabled: false,
          send_reminders: false,
        },
      });

      const missingColumnFromError = (error: { message?: string } | null | undefined) => {
        return error?.message?.match(/Could not find the '([^']+)' column/)?.[1] || null;
      };

      const insertOneTolerant = async (table: string, payload: Record<string, unknown>) => {
        const client = adminClient();
        let row = { ...payload };
        let result = await (client as any)
          .from(table)
          .insert(row)
          .select()
          .single();

        for (let attempt = 0; result.error && attempt < 8; attempt += 1) {
          const missingColumn = missingColumnFromError(result.error);
          if (!missingColumn || !(missingColumn in row)) break;

          const { [missingColumn]: _removed, ...nextRow } = row;
          row = nextRow;
          result = await (client as any)
            .from(table)
            .insert(row)
            .select()
            .single();
        }

        if (result.error || !result.data) {
          throw new Error(`Could not insert ${table}: ${result.error?.message || 'missing row'}`);
        }

        return result.data as any;
      };

      const deleteByIds = async (table: string, ids: string[]) => {
        const filtered = ids.filter(Boolean);
        if (filtered.length === 0) return;

        const client = adminClient();
        await (client as any).from(table).delete().in('id', filtered);
      };

      const findExpenseCategory = async () => {
        const client = adminClient();
        const exact = await client
          .from('categories')
          .select('id, display_name, name')
          .eq('entity_type', 'expense')
          .is('clinic_id', null)
          .is('parent_id', null)
          .ilike('display_name', 'Otros')
          .limit(1)
          .maybeSingle();

        if (exact.data?.id) return exact.data;

        const fallback = await client
          .from('categories')
          .select('id, display_name, name')
          .eq('entity_type', 'expense')
          .is('clinic_id', null)
          .is('parent_id', null)
          .limit(1)
          .maybeSingle();

        if (fallback.error || !fallback.data?.id) {
          throw new Error(`Could not find expense category for cron QA seed: ${fallback.error?.message || 'missing category'}`);
        }

        return fallback.data;
      };

      on('task', {
        async qaCreateConfirmedUser({ email, password }: { email: string; password: string }) {
          const client = adminClient();
          const existing = await findAuthUserByEmail(email);

          if (existing?.id) {
            await deleteOwnedWorkspaceTree(existing.id);
            await deleteUserMembershipsAndInvitations(email, existing.id);
            const { error: deleteError } = await client.auth.admin.deleteUser(existing.id);
            if (deleteError) throw new Error(`Could not reset existing QA user: ${deleteError.message}`);
          }

          const { data, error } = await client.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              first_name: 'QA',
              last_name: 'Onboarding',
              full_name: 'QA Onboarding',
            },
          });

          if (error || !data.user) {
            throw new Error(`Could not create QA user: ${error?.message || 'missing user'}`);
          }

          return { id: data.user.id, email: data.user.email };
        },

        async qaDeleteUserByEmail(email: string) {
          const client = adminClient();
          const user = await findAuthUserByEmail(email);
          if (!user?.id) {
            await deleteUserMembershipsAndInvitations(email);
            return { deleted: false };
          }

          await deleteOwnedWorkspaceTree(user.id);
          await deleteUserMembershipsAndInvitations(email, user.id);
          const { error } = await client.auth.admin.deleteUser(user.id);
          if (error) throw new Error(`Could not delete QA user: ${error.message}`);

          return { deleted: true };
        },

        async qaGetLatestInvitationToken(email: string) {
          const client = adminClient();
          const { data, error } = await client
            .from('invitations')
            .select('id, email, role, token, clinic_ids, expires_at, accepted_at')
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) throw new Error(`Could not fetch QA invitation: ${error.message}`);
          if (!data?.token) throw new Error(`No QA invitation token found for ${email}`);

          return data;
        },

        async qaCronSeed({
          stamp,
          clinicName,
          serviceName,
        }: {
          stamp: string;
          clinicName: string;
          serviceName: string;
        }) {
          const client = adminClient();

          const { data: clinic, error: clinicError } = await client
            .from('clinics')
            .select('id, name, auto_complete_appointments, notification_settings')
            .eq('name', clinicName)
            .single();

          if (clinicError || !clinic?.id) {
            throw new Error(`Could not find QA clinic "${clinicName}": ${clinicError?.message || 'missing clinic'}`);
          }

          const { data: service, error: serviceError } = await client
            .from('services')
            .select('id, name, est_minutes')
            .eq('clinic_id', clinic.id)
            .eq('name', serviceName)
            .single();

          if (serviceError || !service?.id) {
            throw new Error(`Could not find QA service "${serviceName}": ${serviceError?.message || 'missing service'}`);
          }

          await client
            .from('clinics')
            .update({
              auto_complete_appointments: false,
              notification_settings: disabledNotificationSettings(),
            })
            .eq('id', clinic.id);

          const patient = await insertOneTolerant('patients', {
            clinic_id: clinic.id,
            first_name: 'QA Cron',
            last_name: stamp,
            email: `${stamp}@laralis.test`,
            phone: '+15555550199',
            first_visit_date: civilDate(0),
            acquisition_date: civilDate(0),
            notes: `qa-cron ${stamp}`,
          });

          const treatmentBase = {
            clinic_id: clinic.id,
            patient_id: patient.id,
            service_id: service.id,
            treatment_time: '10:00',
            duration_minutes: Number(service.est_minutes || 45),
            minutes: Number(service.est_minutes || 45),
            fixed_cost_per_minute_cents: 100,
            fixed_per_minute_cents: 100,
            variable_cost_cents: 2500,
            margin_pct: 55,
            price_cents: 150000,
            amount_paid_cents: 0,
            pending_balance_cents: 150000,
          };

          const pastTreatment = await insertOneTolerant('treatments', {
            ...treatmentBase,
            treatment_date: civilDate(-2),
            status: 'scheduled',
            notes: `qa-cron-past ${stamp}`,
          });

          const futureTreatment = await insertOneTolerant('treatments', {
            ...treatmentBase,
            treatment_date: civilDate(3),
            status: 'scheduled',
            notes: `qa-cron-future ${stamp}`,
          });

          const reminder = await insertOneTolerant('scheduled_reminders', {
            clinic_id: clinic.id,
            treatment_id: futureTreatment.id,
            patient_id: patient.id,
            scheduled_for: new Date(Date.now() - 60_000).toISOString(),
            reminder_type: '24h',
            status: 'pending',
          });

          const category = await findExpenseCategory();
          const recurringExpense = await insertOneTolerant('expenses', {
            clinic_id: clinic.id,
            expense_date: civilDate(-45),
            category_id: category.id,
            category: category.display_name || category.name || 'Otros',
            subcategory: 'QA',
            description: `QA Cron Recurring ${stamp}`,
            amount_cents: 12345,
            vendor: 'QA Cron',
            is_recurring: true,
            is_paid: true,
            is_variable: false,
            expense_category: 'software_subscriptions',
            auto_processed: false,
            recurrence_interval: 'monthly',
            recurrence_day: 1,
            next_recurrence_date: civilDate(-1),
            notes: `qa-cron ${stamp}`,
          });

          await client
            .from('clinics')
            .update({
              auto_complete_appointments: true,
              notification_settings: cronNotificationSettings(),
            })
            .eq('id', clinic.id);

          return {
            stamp,
            clinicId: clinic.id,
            serviceId: service.id,
            patientId: patient.id,
            pastTreatmentId: pastTreatment.id,
            futureTreatmentId: futureTreatment.id,
            reminderId: reminder.id,
            recurringExpenseId: recurringExpense.id,
            previousClinic: {
              auto_complete_appointments: clinic.auto_complete_appointments,
              notification_settings: clinic.notification_settings,
            },
          };
        },

        async qaCronState({
          patientId,
          pastTreatmentId,
          futureTreatmentId,
          reminderId,
          recurringExpenseId,
        }: {
          patientId: string;
          pastTreatmentId: string;
          futureTreatmentId: string;
          reminderId: string;
          recurringExpenseId: string;
        }) {
          const client = adminClient();

          const { data: reminder, error: reminderError } = await client
            .from('scheduled_reminders')
            .select('*')
            .eq('id', reminderId)
            .single();
          if (reminderError) throw new Error(`Could not read cron reminder: ${reminderError.message}`);

          const { data: emails, error: emailError } = await client
            .from('email_notifications')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });
          if (emailError) throw new Error(`Could not read cron emails: ${emailError.message}`);

          const { data: treatments, error: treatmentError } = await client
            .from('treatments')
            .select('id, status, treatment_date, notes')
            .in('id', [pastTreatmentId, futureTreatmentId]);
          if (treatmentError) throw new Error(`Could not read cron treatments: ${treatmentError.message}`);

          const { data: generatedExpenses, error: generatedError } = await client
            .from('expenses')
            .select('id, parent_expense_id, expense_date, description, amount_cents')
            .eq('parent_expense_id', recurringExpenseId);
          if (generatedError) throw new Error(`Could not read generated recurring expenses: ${generatedError.message}`);

          const { data: recurringExpense, error: recurringError } = await client
            .from('expenses')
            .select('id, next_recurrence_date, description, amount_cents')
            .eq('id', recurringExpenseId)
            .single();
          if (recurringError) throw new Error(`Could not read recurring expense template: ${recurringError.message}`);

          return {
            reminder,
            emails: emails || [],
            treatments: treatments || [],
            generatedExpenses: generatedExpenses || [],
            recurringExpense,
          };
        },

        async qaCronCleanup(context: {
          stamp?: string;
          clinicId?: string;
          previousClinic?: {
            auto_complete_appointments?: boolean | null;
            notification_settings?: unknown;
          };
        }) {
          const client = adminClient();
          const stamp = context?.stamp;

          if (stamp) {
            const { data: patients } = await client
              .from('patients')
              .select('id')
              .ilike('email', `%${stamp}%`);
            const patientIds = (patients || []).map((row) => row.id);

            const { data: treatments } = await client
              .from('treatments')
              .select('id')
              .ilike('notes', `%${stamp}%`);
            const treatmentIds = (treatments || []).map((row) => row.id);

            if (treatmentIds.length > 0) {
              await client.from('scheduled_reminders').delete().in('treatment_id', treatmentIds);
            }
            await client.from('email_notifications').delete().ilike('recipient_email', `%${stamp}%`);
            await client.from('expenses').delete().ilike('description', `%${stamp}%`);
            await deleteByIds('treatments', treatmentIds);
            await deleteByIds('patients', patientIds);
          }

          if (context?.clinicId) {
            await client
              .from('clinics')
              .update({
                auto_complete_appointments: Boolean(context.previousClinic?.auto_complete_appointments),
                notification_settings: context.previousClinic?.notification_settings || disabledNotificationSettings(),
              })
              .eq('id', context.clinicId);
          }

          return { cleaned: true };
        },
      });
      
      return config;
    },
    
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
  },
  
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },
});
