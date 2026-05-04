import { defineConfig } from 'cypress';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

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

      const resolveProjectPath = (relativeOrAbsolutePath: string) => {
        if (path.isAbsolute(relativeOrAbsolutePath)) {
          return relativeOrAbsolutePath;
        }

        return path.resolve(config.projectRoot, relativeOrAbsolutePath);
      };

      const safeSnapshotName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-');

      const findLatestScreenshot = ({
        screenshotName,
        specName,
      }: {
        screenshotName: string;
        specName?: string;
      }) => {
        const screenshotsRoot = path.resolve(config.projectRoot, 'cypress', 'screenshots');
        const targetFileName = `${screenshotName}.png`;
        const candidates: Array<{ filePath: string; mtimeMs: number }> = [];

        const walk = (directory: string) => {
          if (!fs.existsSync(directory)) return;

          for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
              walk(entryPath);
              continue;
            }

            if (entry.name !== targetFileName) continue;
            if (specName && !entryPath.includes(specName)) continue;

            candidates.push({
              filePath: entryPath,
              mtimeMs: fs.statSync(entryPath).mtimeMs,
            });
          }
        };

        walk(screenshotsRoot);
        candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);

        return candidates[0]?.filePath || '';
      };

      const comparePngSnapshot = async ({
        resolvedActualPath,
        baselineName,
        maxDiffRatio = 0.02,
        threshold = 0.1,
      }: {
        resolvedActualPath: string;
        baselineName: string;
        maxDiffRatio?: number;
        threshold?: number;
      }) => {
        if (!resolvedActualPath || !fs.existsSync(resolvedActualPath)) {
          throw new Error(`Visual snapshot actual file not found for "${baselineName}"`);
        }

        const normalizedBaselineName = safeSnapshotName(baselineName);
        const baselinePath = path.resolve(
          config.projectRoot,
          'cypress',
          'visual-baselines',
          `${normalizedBaselineName}.png`
        );
        const diffPath = path.resolve(
          config.projectRoot,
          'cypress',
          'visual-diffs',
          `${normalizedBaselineName}.diff.png`
        );
        const shouldUpdate = process.env.CYPRESS_UPDATE_SNAPSHOTS === 'true';
        const baselineExists = fs.existsSync(baselinePath);

        fs.mkdirSync(path.dirname(baselinePath), { recursive: true });

        if (shouldUpdate || !baselineExists) {
          if (!shouldUpdate) {
            throw new Error(
              `Missing visual baseline ${baselinePath}. Re-run with CYPRESS_UPDATE_SNAPSHOTS=true to create it.`
            );
          }

          fs.copyFileSync(resolvedActualPath, baselinePath);
          return {
            passed: true,
            created: !baselineExists,
            updated: true,
            diffPixels: 0,
            totalPixels: 0,
            ratio: 0,
            baselinePath,
            actualPath: resolvedActualPath,
            diffPath: null,
          };
        }

        const [{ PNG }, pixelmatchModule] = await Promise.all([import('pngjs'), import('pixelmatch')]);
        const actual = PNG.sync.read(fs.readFileSync(resolvedActualPath));
        const baseline = PNG.sync.read(fs.readFileSync(baselinePath));

        if (actual.width !== baseline.width || actual.height !== baseline.height) {
          throw new Error(
            `Visual snapshot dimensions changed for "${baselineName}": actual ${actual.width}x${actual.height}, baseline ${baseline.width}x${baseline.height}`
          );
        }

        const diff = new PNG({ width: baseline.width, height: baseline.height });
        const diffPixels = pixelmatchModule.default(
          actual.data,
          baseline.data,
          diff.data,
          baseline.width,
          baseline.height,
          { threshold }
        );
        const totalPixels = baseline.width * baseline.height;
        const ratio = totalPixels === 0 ? 0 : diffPixels / totalPixels;

        fs.mkdirSync(path.dirname(diffPath), { recursive: true });
        if (diffPixels > 0) {
          fs.writeFileSync(diffPath, PNG.sync.write(diff));
        } else if (fs.existsSync(diffPath)) {
          fs.rmSync(diffPath);
        }

        if (ratio > maxDiffRatio) {
          throw new Error(
            `Visual snapshot "${baselineName}" changed by ${(ratio * 100).toFixed(2)}%, above ${(maxDiffRatio * 100).toFixed(2)}%. Diff: ${diffPath}`
          );
        }

        return {
          passed: true,
          created: false,
          updated: false,
          diffPixels,
          totalPixels,
          ratio,
          baselinePath,
          actualPath: resolvedActualPath,
          diffPath: diffPixels > 0 ? diffPath : null,
        };
      };

      const chromeExecutablePath = () => {
        const candidates = [
          process.env.CHROME_PATH || '',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ].filter(Boolean);

        const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
        if (!executablePath) {
          throw new Error('Could not find Chrome. Set CHROME_PATH to run visual regression snapshots.');
        }

        return executablePath;
      };

      const stageTestCredentials = () => ({
        email: envValue('CYPRESS_STAGE_TEST_EMAIL', 'STAGE_TEST_EMAIL') || 'qa-owner@laralis.test',
        password: envValue('CYPRESS_STAGE_TEST_PASSWORD', 'STAGE_TEST_PASSWORD') || 'LaralisQA!2026',
      });

      type VisualSnapshotAction =
        | { type: 'clickRole'; role?: 'button' | 'tab' | 'link'; name: string }
        | { type: 'clickSelector'; selector: string }
        | { type: 'fillSelector'; selector: string; value: string }
        | { type: 'waitForSelector'; selector: string }
        | { type: 'waitForText'; text: string }
        | { type: 'openFirstPatientWithHistory' };

      const patientDetailRouteFromQaSeed = async (page: any) => {
        const patientId = await page.evaluate(() => {
          return fetch('/api/treatments')
            .then((response) => response.json())
            .then((json) => {
              const treatments = json.data || [];
              const grouped: Record<string, { patient: { id: string }; count: number }> = {};

              for (const treatment of treatments) {
                const patient = treatment.patient;
                if (!patient?.id) continue;

                grouped[patient.id] = grouped[patient.id] || { patient, count: 0 };
                grouped[patient.id].count += 1;
              }

              const selected = Object.values(grouped)
                .filter((item) => item.count >= 2)
                .sort((left, right) => right.count - left.count)[0];

              if (!selected?.patient?.id) {
                throw new Error('No seeded QA patient with treatment history was found');
              }

              return selected.patient.id;
            });
        });

        return `/patients/${patientId}`;
      };

      const runVisualAction = async (page: any, action: VisualSnapshotAction) => {
        if (action.type === 'clickRole') {
          await page.getByRole(action.role || 'button', { name: new RegExp(action.name, 'i') }).first().click();
          await page.waitForLoadState('networkidle').catch(() => undefined);
          return;
        }

        if (action.type === 'clickSelector') {
          await page.locator(action.selector).first().click();
          await page.waitForLoadState('networkidle').catch(() => undefined);
          return;
        }

        if (action.type === 'fillSelector') {
          await page.locator(action.selector).first().fill(action.value);
          return;
        }

        if (action.type === 'waitForSelector') {
          await page.locator(action.selector).first().waitFor({ state: 'visible' });
          return;
        }

        if (action.type === 'waitForText') {
          await page.waitForFunction(
            (pattern) => new RegExp(pattern as string, 'i').test(document.body.innerText),
            action.text,
            { timeout: 30_000 }
          );
          return;
        }

        if (action.type === 'openFirstPatientWithHistory') {
          const route = await patientDetailRouteFromQaSeed(page);
          await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle').catch(() => undefined);
        }
      };

      on('task', {
        async captureStageVisualSnapshot({
          routePath,
          theme = 'light',
          locale = 'es',
          clinicKey = 'clinicA',
          viewport = { width: 1440, height: 900 },
          tabPattern,
          actions = [],
          waitForSelectors = [],
          waitForText,
          snapshotSelector = '[data-testid="app-main-content"], main',
          minWidth = 280,
          minHeight = 220,
          hideAssistant = true,
          baselineName,
          maxDiffRatio = 0.02,
          threshold = 0.1,
        }: {
          routePath: string;
          theme?: 'dark' | 'light';
          locale?: 'es' | 'en';
          clinicKey?: string;
          viewport?: { width: number; height: number };
          tabPattern?: string;
          actions?: VisualSnapshotAction[];
          waitForSelectors?: string[];
          waitForText?: string;
          snapshotSelector?: string;
          minWidth?: number;
          minHeight?: number;
          hideAssistant?: boolean;
          baselineName: string;
          maxDiffRatio?: number;
          threshold?: number;
        }) {
          try {
          if (!baseUrl.includes('laralis-monorepo-preview')) {
            throw new Error('Visual regression snapshots are stage-only and require CYPRESS_BASE_URL for preview.');
          }

          const dataset = JSON.parse(
            fs.readFileSync(path.resolve(config.projectRoot, '../../docs/qa/dataset.json'), 'utf8')
          );
          const clinicDefinition = dataset.clinics.find((clinic: { key: string }) => clinic.key === clinicKey);
          const clinicName = clinicDefinition?.name;
          if (!clinicName) throw new Error(`Could not resolve QA ${clinicKey} from docs/qa/dataset.json`);

          const { chromium } = await import('playwright-core');
          const browser = await chromium.launch({
            executablePath: chromeExecutablePath(),
            headless: true,
            args: ['--disable-dev-shm-usage', '--disable-gpu'],
          });

          const { email, password } = stageTestCredentials();
          const actualPath = path.resolve(
            config.projectRoot,
            'cypress',
            'visual-actual',
            `${safeSnapshotName(baselineName)}.png`
          );

          try {
            fs.mkdirSync(path.dirname(actualPath), { recursive: true });

            const context = await browser.newContext({
              viewport,
              deviceScaleFactor: 1,
              reducedMotion: 'reduce',
            });
            await context.addCookies([{ name: 'locale', value: locale, url: baseUrl }]);
            await context.addInitScript(({ selectedTheme, selectedLocale }) => {
              window.localStorage.setItem('laralis-theme', selectedTheme as string);
              window.localStorage.setItem('preferred-locale', selectedLocale as string);
            }, { selectedTheme: theme, selectedLocale: locale });

            const page = await context.newPage();
            page.setDefaultTimeout(30_000);

            let loggedIn = false;
            for (let attempt = 0; attempt < 3 && !loggedIn; attempt += 1) {
              await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
              await page.locator('input[type="email"]').waitFor({ state: 'visible' });
              await page.waitForTimeout(750 + attempt * 500);
              await page.locator('input[type="email"]').fill(email);
              await page.locator('input[type="password"]').fill(password);
              await page.locator('button[type="submit"]').click();

              loggedIn = await page
                .waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15_000 })
                .then(() => true)
                .catch(() => false);
            }

            if (!loggedIn) {
              throw new Error(`Could not log in visual regression user ${email}`);
            }

            await page.evaluate((resolvedClinicName) => {
              return fetch('/api/clinics')
                .then((clinicsResponse) => clinicsResponse.json())
                .then((clinicsJson) => {
                  const clinic = (clinicsJson.data || []).find((item: { name: string }) => item.name === resolvedClinicName);
                  if (!clinic?.id) throw new Error(`QA clinic not found: ${resolvedClinicName}`);

                  return fetch('/api/clinics', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ clinicId: clinic.id }),
                  });
                });
            }, clinicName);

            const resolvedRoutePath = routePath === '__public_booking_clinic__'
              ? `/book/${clinicDefinition.slug}`
              : routePath;

            await page.goto(new URL(resolvedRoutePath, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle').catch(() => undefined);
            await page.waitForFunction(
              (selectedTheme) => document.documentElement.classList.contains('dark') === (selectedTheme === 'dark'),
              theme,
              { timeout: 30_000 }
            );

            if (tabPattern) {
              await page.getByRole('tab', { name: new RegExp(tabPattern, 'i') }).click();
              await page.waitForLoadState('networkidle').catch(() => undefined);
            }

            for (const action of actions) {
              await runVisualAction(page, action);
            }

            for (const selector of waitForSelectors) {
              await page.locator(selector).first().waitFor({ state: 'visible' });
            }

            if (waitForText) {
              await page.waitForFunction(
                (pattern) => new RegExp(pattern as string, 'i').test(document.body.innerText),
                waitForText,
                { timeout: 30_000 }
              );
            }

            await page.addStyleTag({
              content: `
                *, *::before, *::after {
                  animation-duration: 0s !important;
                  animation-delay: 0s !important;
                  transition-duration: 0s !important;
                  transition-delay: 0s !important;
                  caret-color: transparent !important;
                  scroll-behavior: auto !important;
                }

                ${hideAssistant ? `
                [data-testid="lara-fab"],
                [data-testid="lara-entry-mode"],
                [data-testid="lara-query-mode"],
                [data-testid="lara-action-card"],` : ''}
                iframe[src*="tawk"],
                [id*="tawk"],
                [class*="tawk"] {
                  visibility: hidden !important;
                }
              `,
            });

            const bodyText = await page.locator('body').innerText();
            if (/Application error|Unhandled Runtime Error|Hydration failed|This page could not be found|404:|500:/i.test(bodyText)) {
              throw new Error(`Fatal UI text found in ${baselineName}`);
            }

            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            if (overflow >= 2) {
              throw new Error(`Unexpected horizontal overflow in ${baselineName}: ${overflow}px`);
            }

            if (snapshotSelector === 'viewport') {
              await page.screenshot({
                path: actualPath,
                animations: 'disabled',
                fullPage: false,
              });
            } else {
              const target = page.locator(snapshotSelector).first();
              const box = await target.boundingBox();
              if (!box || box.width < minWidth || box.height < minHeight) {
                throw new Error(`Snapshot target is not large enough for ${baselineName}`);
              }

              await target.screenshot({
                path: actualPath,
                animations: 'disabled',
              });
            }
          } finally {
            await browser.close();
          }

          return comparePngSnapshot({
            resolvedActualPath: actualPath,
            baselineName,
            maxDiffRatio,
            threshold,
          });
          } catch (error) {
            return {
              passed: false,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : null,
            };
          }
        },

        async compareSnapshot({
          actualPath,
          screenshotName,
          specName,
          baselineName,
          maxDiffRatio = 0.02,
          threshold = 0.1,
        }: {
          actualPath?: string;
          screenshotName?: string;
          specName?: string;
          baselineName: string;
          maxDiffRatio?: number;
          threshold?: number;
        }) {
          const resolvedActualPath = actualPath
            ? resolveProjectPath(actualPath)
            : screenshotName
              ? findLatestScreenshot({ screenshotName, specName })
              : '';

          return comparePngSnapshot({
            resolvedActualPath,
            baselineName,
            maxDiffRatio,
            threshold,
          });
        },

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
