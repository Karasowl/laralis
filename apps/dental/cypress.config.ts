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
