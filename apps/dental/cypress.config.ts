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

      let dotenvValues: Record<string, string> | null = null;
      const loadDotenvValues = () => {
        if (dotenvValues) return dotenvValues;

        dotenvValues = {};
        const envFiles = [
          '.env.local',
          '.env.production.local',
          '.env',
        ].map((fileName) => path.resolve(config.projectRoot, fileName));

        for (const envFile of envFiles) {
          if (!fs.existsSync(envFile)) continue;

          const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const equalsIndex = trimmed.indexOf('=');
            if (equalsIndex <= 0) continue;

            const key = trimmed.slice(0, equalsIndex).trim();
            let value = trimmed.slice(equalsIndex + 1).trim();
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
            }

            if (!(key in dotenvValues)) {
              dotenvValues[key] = value;
            }
          }
        }

        return dotenvValues;
      };

      const envValue = (...names: string[]) => {
        const localEnv = loadDotenvValues();

        for (const name of names) {
          const value = process.env[name] || config.env?.[name] || localEnv[name];
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

      const toCivilDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const parseCivilDate = (value: string) => {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
      };

      const addDaysToCivilDate = (value: string, offsetDays: number) => {
        const date = parseCivilDate(value);
        date.setDate(date.getDate() + offsetDays);
        return toCivilDate(date);
      };

      const currentWeekEnd = (value: string) => {
        const date = parseCivilDate(value);
        const day = date.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const monday = new Date(date);
        monday.setDate(date.getDate() + mondayOffset);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return toCivilDate(sunday);
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
          frozenNow = '2026-05-04T18:00:00.000Z',
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
          frozenNow?: string;
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
            await context.addInitScript((nowIso) => {
              const RealDate = Date;
              const fixedTime = RealDate.parse(nowIso as string);

              function FixedDate(this: any, ...args: any[]) {
                if (!(this instanceof FixedDate)) {
                  return new RealDate(fixedTime).toString();
                }

                const dateArgs = args.length === 0 ? [fixedTime] : args;
                return Reflect.construct(RealDate, dateArgs, FixedDate);
              }

              Object.setPrototypeOf(FixedDate, RealDate);
              FixedDate.prototype = RealDate.prototype;
              (FixedDate as any).now = () => fixedTime;
              (FixedDate as any).parse = RealDate.parse;
              (FixedDate as any).UTC = RealDate.UTC;
              window.Date = FixedDate as unknown as DateConstructor;
            }, frozenNow);

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

        async qaGenerateAccountDeletionOtp(email: string) {
          const client = adminClient();
          const { data, error } = await client.auth.admin.generateLink({
            type: 'magiclink',
            email,
          });

          const otp = data?.properties?.email_otp;
          if (error || !otp) {
            throw new Error(`Could not generate QA account deletion OTP: ${error?.message || 'missing OTP'}`);
          }

          return { email, otp };
        },

        async qaAccountDeletionState({
          email,
          workspaceName,
        }: {
          email: string;
          workspaceName: string;
        }) {
          const client = adminClient();
          const user = await findAuthUserByEmail(email);

          const { data: workspaces, error: workspaceError } = await client
            .from('workspaces')
            .select('id, owner_id, name')
            .eq('name', workspaceName);
          if (workspaceError) throw new Error(`Could not inspect QA workspaces: ${workspaceError.message}`);

          const workspaceIds = (workspaces || []).map((workspace) => workspace.id).filter(Boolean);
          let clinics: any[] = [];
          let patients: any[] = [];

          if (workspaceIds.length > 0) {
            const { data: clinicRows, error: clinicError } = await client
              .from('clinics')
              .select('id, workspace_id, name')
              .in('workspace_id', workspaceIds);
            if (clinicError) throw new Error(`Could not inspect QA clinics: ${clinicError.message}`);
            clinics = clinicRows || [];

            const clinicIds = clinics.map((clinic) => clinic.id).filter(Boolean);
            if (clinicIds.length > 0) {
              const { data: patientRows, error: patientError } = await client
                .from('patients')
                .select('id, clinic_id, email')
                .in('clinic_id', clinicIds);
              if (patientError) throw new Error(`Could not inspect QA patients: ${patientError.message}`);
              patients = patientRows || [];
            }
          }

          return {
            authUserExists: Boolean(user?.id),
            workspaceCount: workspaceIds.length,
            clinicCount: clinics.length,
            patientCount: patients.length,
          };
        },

        async qaPrescriptionCleanup({ stamp }: { stamp?: string }) {
          if (!stamp) return { cleaned: false };

          const client = adminClient();
          const { data: patients } = await client
            .from('patients')
            .select('id')
            .ilike('email', `%${stamp}%`);
          const patientIds = (patients || []).map((patient) => patient.id).filter(Boolean);

          const prescriptionIds = new Set<string>();

          const { data: prescriptionsByNotes } = await client
            .from('prescriptions')
            .select('id')
            .ilike('notes', `%${stamp}%`);
          for (const prescription of prescriptionsByNotes || []) {
            if (prescription.id) prescriptionIds.add(prescription.id);
          }

          if (patientIds.length > 0) {
            const { data: prescriptionsByPatient } = await client
              .from('prescriptions')
              .select('id')
              .in('patient_id', patientIds);
            for (const prescription of prescriptionsByPatient || []) {
              if (prescription.id) prescriptionIds.add(prescription.id);
            }
          }

          const prescriptionIdList = Array.from(prescriptionIds);
          if (prescriptionIdList.length > 0) {
            await client.from('prescription_items').delete().in('prescription_id', prescriptionIdList);
            await deleteByIds('prescriptions', prescriptionIdList);
          }

          const { data: medications } = await client
            .from('medications')
            .select('id')
            .ilike('name', `%${stamp}%`);
          const medicationIds = (medications || []).map((medication) => medication.id).filter(Boolean);
          await deleteByIds('medications', medicationIds);
          await deleteByIds('patients', patientIds);

          return {
            cleaned: true,
            patientCount: patientIds.length,
            prescriptionCount: prescriptionIdList.length,
            medicationCount: medicationIds.length,
          };
        },

        async qaInboxSeed({
          stamp,
          clinicName,
        }: {
          stamp: string;
          clinicName: string;
        }) {
          const client = adminClient();

          const { data: clinic, error: clinicError } = await client
            .from('clinics')
            .select('id, name')
            .eq('name', clinicName)
            .single();

          if (clinicError || !clinic?.id) {
            throw new Error(`Could not find QA clinic "${clinicName}": ${clinicError?.message || 'missing clinic'}`);
          }

          const { data: campaign } = await client
            .from('marketing_campaigns')
            .select('id, name')
            .eq('clinic_id', clinic.id)
            .eq('name', 'Meta Mayo')
            .maybeSingle();

          const numericTail = stamp.replace(/\D/g, '').slice(-7).padStart(7, '0');
          const phone = `+1555${numericTail}`;
          const contactAddress = `whatsapp:${phone}`;
          const contactName = `QA Inbox ${stamp}`;
          const nowIso = new Date().toISOString();

          const lead = await insertOneTolerant('leads', {
            clinic_id: clinic.id,
            campaign_id: campaign?.id || null,
            full_name: contactName,
            email: `${stamp}@laralis.test`,
            phone,
            channel: 'whatsapp',
            status: 'new',
            notes: `qa-inbox ${stamp}`,
            metadata: {
              qa: true,
              stamp,
              source: 'cypress',
            },
          });

          const conversation = await insertOneTolerant('inbox_conversations', {
            clinic_id: clinic.id,
            campaign_id: campaign?.id || null,
            lead_id: lead.id,
            channel: 'whatsapp',
            contact_address: contactAddress,
            contact_name: contactName,
            status: 'bot',
            conversation_state: 'chatting',
            last_message_at: nowIso,
            last_message_preview: `qa-inbox seeded ${stamp}`,
            unread_count: 1,
            metadata: {
              qa: true,
              stamp,
            },
          });

          const inboundMessage = await insertOneTolerant('inbox_messages', {
            conversation_id: conversation.id,
            role: 'user',
            content: `Hola, quiero una cita desde WhatsApp QA ${stamp}`,
            direction: 'inbound',
            message_type: 'text',
            channel_message_id: `qa-inbound-${stamp}`,
            metadata: {
              qa: true,
              stamp,
            },
          });

          return {
            stamp,
            clinicId: clinic.id,
            campaignId: campaign?.id || null,
            leadId: lead.id,
            conversationId: conversation.id,
            inboundMessageId: inboundMessage.id,
            contactName,
            phone,
            contactAddress,
          };
        },

        async qaInboxState({ conversationId }: { conversationId: string }) {
          const client = adminClient();

          const { data: conversation, error: conversationError } = await client
            .from('inbox_conversations')
            .select('*')
            .eq('id', conversationId)
            .single();
          if (conversationError || !conversation) {
            throw new Error(`Could not read QA inbox conversation: ${conversationError?.message || 'missing conversation'}`);
          }

          const { data: messages, error: messagesError } = await client
            .from('inbox_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
          if (messagesError) throw new Error(`Could not read QA inbox messages: ${messagesError.message}`);

          let lead: any = null;
          if (conversation.lead_id) {
            const { data, error } = await client
              .from('leads')
              .select('*')
              .eq('id', conversation.lead_id)
              .maybeSingle();
            if (error) throw new Error(`Could not read QA inbox lead: ${error.message}`);
            lead = data;
          }

          let patient: any = null;
          if (conversation.patient_id) {
            const { data, error } = await client
              .from('patients')
              .select('*')
              .eq('id', conversation.patient_id)
              .maybeSingle();
            if (error) throw new Error(`Could not read QA inbox patient: ${error.message}`);
            patient = data;
          }

          return {
            conversation,
            lead,
            patient,
            messages: messages || [],
          };
        },

        async qaInboxCleanup({ stamp }: { stamp?: string }) {
          if (!stamp) return { cleaned: false };

          const client = adminClient();
          const conversationIds = new Set<string>();
          const leadIds = new Set<string>();
          const patientIds = new Set<string>();

          const { data: messages } = await client
            .from('inbox_messages')
            .select('conversation_id')
            .ilike('content', `%${stamp}%`);
          for (const message of messages || []) {
            if (message.conversation_id) conversationIds.add(message.conversation_id);
          }

          const { data: conversations } = await client
            .from('inbox_conversations')
            .select('id, lead_id, patient_id')
            .or(`last_message_preview.ilike.%${stamp}%,contact_name.ilike.%${stamp}%,contact_address.ilike.%${stamp}%`);
          for (const conversation of conversations || []) {
            if (conversation.id) conversationIds.add(conversation.id);
            if (conversation.lead_id) leadIds.add(conversation.lead_id);
            if (conversation.patient_id) patientIds.add(conversation.patient_id);
          }

          if (conversationIds.size > 0) {
            const { data: linkedConversations } = await client
              .from('inbox_conversations')
              .select('id, lead_id, patient_id')
              .in('id', Array.from(conversationIds));
            for (const conversation of linkedConversations || []) {
              if (conversation.lead_id) leadIds.add(conversation.lead_id);
              if (conversation.patient_id) patientIds.add(conversation.patient_id);
            }
          }

          const { data: leads } = await client
            .from('leads')
            .select('id, converted_patient_id')
            .or(`full_name.ilike.%${stamp}%,email.ilike.%${stamp}%,notes.ilike.%${stamp}%`);
          for (const lead of leads || []) {
            if (lead.id) leadIds.add(lead.id);
            if (lead.converted_patient_id) patientIds.add(lead.converted_patient_id);
          }

          const { data: patients } = await client
            .from('patients')
            .select('id')
            .or(`email.ilike.%${stamp}%,last_name.ilike.%${stamp}%,notes.ilike.%${stamp}%`);
          for (const patient of patients || []) {
            if (patient.id) patientIds.add(patient.id);
          }

          const conversationIdList = Array.from(conversationIds);
          if (conversationIdList.length > 0) {
            await client.from('inbox_messages').delete().in('conversation_id', conversationIdList);
            await deleteByIds('inbox_conversations', conversationIdList);
          }

          await deleteByIds('leads', Array.from(leadIds));
          await deleteByIds('patients', Array.from(patientIds));

          return {
            cleaned: true,
            conversationCount: conversationIdList.length,
            leadCount: leadIds.size,
            patientCount: patientIds.size,
          };
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

        async qaDashboardAppointmentsSeed({
          stamp,
          clinicName,
          serviceName,
          asOfDate,
        }: {
          stamp: string;
          clinicName: string;
          serviceName: string;
          asOfDate?: string;
        }) {
          const client = adminClient();
          const resolvedAsOfDate = asOfDate || toCivilDate(new Date());
          const tomorrowDate = addDaysToCivilDate(resolvedAsOfDate, 1);
          const weekEndDate = currentWeekEnd(resolvedAsOfDate);
          const laterThisWeekDate = addDaysToCivilDate(resolvedAsOfDate, 2) <= weekEndDate
            ? addDaysToCivilDate(resolvedAsOfDate, 2)
            : null;
          const nextWeekDate = addDaysToCivilDate(weekEndDate, 1);

          const { data: clinic, error: clinicError } = await client
            .from('clinics')
            .select('id, name')
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

          const patient = await insertOneTolerant('patients', {
            clinic_id: clinic.id,
            first_name: 'QA Dashboard',
            last_name: stamp,
            email: `${stamp}@laralis.test`,
            phone: '+15555550251',
            first_visit_date: resolvedAsOfDate,
            acquisition_date: resolvedAsOfDate,
            notes: `qa-dashboard-appointments ${stamp}`,
          });

          const treatmentBase = {
            clinic_id: clinic.id,
            patient_id: patient.id,
            service_id: service.id,
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

          const treatments = [
            await insertOneTolerant('treatments', {
              ...treatmentBase,
              treatment_date: resolvedAsOfDate,
              treatment_time: '09:00',
              status: 'scheduled',
              notes: `qa-dashboard-appointments today-treatment ${stamp}`,
            }),
            await insertOneTolerant('treatments', {
              ...treatmentBase,
              treatment_date: tomorrowDate,
              treatment_time: '09:30',
              status: 'scheduled',
              notes: `qa-dashboard-appointments tomorrow-treatment ${stamp}`,
            }),
            await insertOneTolerant('treatments', {
              ...treatmentBase,
              treatment_date: resolvedAsOfDate,
              treatment_time: '11:00',
              status: 'cancelled',
              notes: `qa-dashboard-appointments cancelled-treatment ${stamp}`,
            }),
            await insertOneTolerant('treatments', {
              ...treatmentBase,
              treatment_date: nextWeekDate,
              treatment_time: '12:00',
              status: 'scheduled',
              notes: `qa-dashboard-appointments next-week-treatment ${stamp}`,
            }),
          ];

          if (laterThisWeekDate) {
            treatments.push(await insertOneTolerant('treatments', {
              ...treatmentBase,
              treatment_date: laterThisWeekDate,
              treatment_time: '10:30',
              status: 'in_progress',
              notes: `qa-dashboard-appointments later-week-treatment ${stamp}`,
            }));
          }

          const bookingBase = {
            clinic_id: clinic.id,
            service_id: service.id,
            patient_id: patient.id,
            patient_email: `${stamp}@laralis.test`,
            patient_phone: '+15555550251',
            patient_notes: `qa-dashboard-appointments ${stamp}`,
            ip_address: '127.0.0.1',
            user_agent: 'laralis-qa',
            referrer: 'cypress',
            utm_source: 'qa',
            utm_medium: 'cypress',
            utm_campaign: 'dashboard-appointments',
          };

          const bookings = [
            await insertOneTolerant('public_bookings', {
              ...bookingBase,
              patient_name: `QA Dashboard Today Booking ${stamp}`,
              requested_date: resolvedAsOfDate,
              requested_time: '10:00',
              status: 'pending',
            }),
            await insertOneTolerant('public_bookings', {
              ...bookingBase,
              patient_name: `QA Dashboard Tomorrow Booking ${stamp}`,
              requested_date: tomorrowDate,
              requested_time: '10:00',
              status: 'confirmed',
              treatment_id: null,
            }),
            await insertOneTolerant('public_bookings', {
              ...bookingBase,
              patient_name: `QA Dashboard Cancelled Booking ${stamp}`,
              requested_date: resolvedAsOfDate,
              requested_time: '13:00',
              status: 'cancelled',
            }),
            await insertOneTolerant('public_bookings', {
              ...bookingBase,
              patient_name: `QA Dashboard Converted Booking ${stamp}`,
              requested_date: tomorrowDate,
              requested_time: '14:00',
              status: 'confirmed',
              treatment_id: treatments[1].id,
            }),
          ];

          return {
            stamp,
            clinicId: clinic.id,
            serviceId: service.id,
            patientId: patient.id,
            treatmentIds: treatments.map((row) => row.id),
            bookingIds: bookings.map((row) => row.id),
            asOfDate: resolvedAsOfDate,
            expected: {
              today: 2,
              tomorrow: 2,
              thisWeek: 2 + (tomorrowDate <= weekEndDate ? 2 : 0) + (laterThisWeekDate ? 1 : 0),
            },
          };
        },

        async qaDashboardAppointmentsCleanup({ stamp }: { stamp?: string }) {
          if (!stamp) return { cleaned: false };

          const client = adminClient();
          const { data: patients } = await client
            .from('patients')
            .select('id')
            .ilike('email', `%${stamp}%`);
          const patientIds = (patients || []).map((row) => row.id).filter(Boolean);

          const { data: treatments } = await client
            .from('treatments')
            .select('id')
            .ilike('notes', `%${stamp}%`);
          const treatmentIds = (treatments || []).map((row) => row.id).filter(Boolean);

          const { data: bookings } = await client
            .from('public_bookings')
            .select('id')
            .ilike('patient_name', `%${stamp}%`);
          const bookingIds = (bookings || []).map((row) => row.id).filter(Boolean);

          await deleteByIds('public_bookings', bookingIds);
          await deleteByIds('treatments', treatmentIds);
          await deleteByIds('patients', patientIds);

          return {
            cleaned: true,
            treatmentCount: treatmentIds.length,
            bookingCount: bookingIds.length,
            patientCount: patientIds.length,
          };
        },

        async qaBookingRequestSeed({
          stamp,
          clinicName,
          serviceName,
          patientLabel = 'Confirm',
          offsetDays = 3,
        }: {
          stamp: string;
          clinicName: string;
          serviceName: string;
          patientLabel?: string;
          offsetDays?: number;
        }) {
          const client = adminClient();
          const requestedDate = addDaysToCivilDate(toCivilDate(new Date()), offsetDays);

          const { data: clinic, error: clinicError } = await client
            .from('clinics')
            .select('id, name')
            .eq('name', clinicName)
            .single();

          if (clinicError || !clinic?.id) {
            throw new Error(`Could not find QA clinic "${clinicName}": ${clinicError?.message || 'missing clinic'}`);
          }

          const { data: service, error: serviceError } = await client
            .from('services')
            .select('id, name')
            .eq('clinic_id', clinic.id)
            .eq('name', serviceName)
            .single();

          if (serviceError || !service?.id) {
            throw new Error(`Could not find QA service "${serviceName}": ${serviceError?.message || 'missing service'}`);
          }

          const booking = await insertOneTolerant('public_bookings', {
            clinic_id: clinic.id,
            service_id: service.id,
            patient_name: `QA Booking ${patientLabel} ${stamp}`,
            patient_email: `${patientLabel.toLowerCase()}-${stamp}@laralis.test`,
            patient_phone: '+15555550277',
            patient_notes: `qa-booking-request ${stamp}`,
            requested_date: requestedDate,
            requested_time: patientLabel === 'Reject' ? '15:00' : '14:00',
            status: 'pending',
            ip_address: '127.0.0.1',
            user_agent: 'laralis-qa',
            referrer: 'cypress',
            utm_source: 'qa',
            utm_medium: 'cypress',
            utm_campaign: 'booking-request-admin',
          });

          return {
            stamp,
            clinicId: clinic.id,
            serviceId: service.id,
            bookingId: booking.id,
            patientEmail: booking.patient_email,
            requestedDate,
            requestedTime: String(booking.requested_time).slice(0, 5),
          };
        },

        async qaBookingRequestState({
          bookingId,
          patientEmail,
        }: {
          bookingId: string;
          patientEmail?: string;
        }) {
          const client = adminClient();
          const { data: booking, error: bookingError } = await client
            .from('public_bookings')
            .select('*')
            .eq('id', bookingId)
            .single();
          if (bookingError) throw new Error(`Could not read QA booking request: ${bookingError.message}`);

          let treatment: any = null;
          if (booking?.treatment_id) {
            const { data, error } = await client
              .from('treatments')
              .select('*')
              .eq('id', booking.treatment_id)
              .single();
            if (error) throw new Error(`Could not read QA treatment from booking: ${error.message}`);
            treatment = data;
          }

          let patient: any = null;
          if (booking?.patient_id) {
            const { data, error } = await client
              .from('patients')
              .select('*')
              .eq('id', booking.patient_id)
              .single();
            if (error) throw new Error(`Could not read QA patient from booking: ${error.message}`);
            patient = data;
          } else if (patientEmail) {
            const { data, error } = await client
              .from('patients')
              .select('*')
              .eq('email', patientEmail)
              .maybeSingle();
            if (error) throw new Error(`Could not read QA patient by email: ${error.message}`);
            patient = data;
          }

          return { booking, treatment, patient };
        },

        async qaBookingRequestCleanup({ stamp }: { stamp?: string }) {
          if (!stamp) return { cleaned: false };

          const client = adminClient();
          const { data: bookings } = await client
            .from('public_bookings')
            .select('id, treatment_id, patient_id, patient_email')
            .ilike('patient_name', `%${stamp}%`);

          const bookingIds = (bookings || []).map((row) => row.id).filter(Boolean);
          const treatmentIdsFromBookings = (bookings || []).map((row) => row.treatment_id).filter(Boolean);
          const patientIdsFromBookings = (bookings || []).map((row) => row.patient_id).filter(Boolean);
          const patientEmails = (bookings || []).map((row) => row.patient_email).filter(Boolean);

          const { data: treatments } = await client
            .from('treatments')
            .select('id')
            .ilike('notes', `%${stamp}%`);
          const treatmentIds = [
            ...treatmentIdsFromBookings,
            ...(treatments || []).map((row) => row.id),
          ].filter(Boolean);

          await deleteByIds('public_bookings', bookingIds);
          await deleteByIds('treatments', Array.from(new Set(treatmentIds)));

          if (patientEmails.length > 0) {
            const { data: patients } = await client
              .from('patients')
              .select('id')
              .in('email', patientEmails);
            const patientIds = [
              ...patientIdsFromBookings,
              ...(patients || []).map((row) => row.id),
            ].filter(Boolean);
            await deleteByIds('patients', Array.from(new Set(patientIds)));
          }

          return {
            cleaned: true,
            bookingCount: bookingIds.length,
            treatmentCount: treatmentIds.length,
            patientCount: patientIdsFromBookings.length,
          };
        },

        async qaScheduleConflictSeed({
          stamp,
          clinicName,
          serviceName,
        }: {
          stamp: string;
          clinicName: string;
          serviceName: string;
        }) {
          const client = adminClient();
          const date = addDaysToCivilDate(toCivilDate(new Date()), 7);

          const { data: clinic, error: clinicError } = await client
            .from('clinics')
            .select('id, name')
            .eq('name', clinicName)
            .single();

          if (clinicError || !clinic?.id) {
            throw new Error(`Could not find QA clinic "${clinicName}": ${clinicError?.message || 'missing clinic'}`);
          }

          const { data: service, error: serviceError } = await client
            .from('services')
            .select('id, name, est_minutes, price_cents, variable_cost_cents, margin_pct')
            .eq('clinic_id', clinic.id)
            .eq('name', serviceName)
            .single();

          if (serviceError || !service?.id) {
            throw new Error(`Could not find QA service "${serviceName}": ${serviceError?.message || 'missing service'}`);
          }

          const patient = await insertOneTolerant('patients', {
            clinic_id: clinic.id,
            first_name: 'QA Conflict',
            last_name: stamp,
            email: `${stamp}@laralis.test`,
            phone: '+15555550310',
            first_visit_date: date,
            acquisition_date: date,
            notes: `qa-schedule-conflict ${stamp}`,
          });

          const treatment = await insertOneTolerant('treatments', {
            clinic_id: clinic.id,
            patient_id: patient.id,
            service_id: service.id,
            treatment_date: date,
            treatment_time: '09:00',
            duration_minutes: 60,
            minutes: 60,
            fixed_cost_per_minute_cents: 100,
            fixed_per_minute_cents: 100,
            variable_cost_cents: Number(service.variable_cost_cents || 0),
            margin_pct: Number(service.margin_pct || 60),
            price_cents: Number(service.price_cents || 150000),
            amount_paid_cents: 0,
            pending_balance_cents: Number(service.price_cents || 150000),
            status: 'scheduled',
            notes: `qa-schedule-conflict existing-treatment ${stamp}`,
          });

          const booking = await insertOneTolerant('public_bookings', {
            clinic_id: clinic.id,
            service_id: service.id,
            patient_id: null,
            patient_name: `QA Conflict Booking ${stamp}`,
            patient_email: `booking-${stamp}@laralis.test`,
            patient_phone: '+15555550311',
            patient_notes: `qa-schedule-conflict ${stamp}`,
            requested_date: date,
            requested_time: '11:00',
            status: 'pending',
            ip_address: '127.0.0.1',
            user_agent: 'laralis-qa',
            referrer: 'cypress',
            utm_source: 'qa',
            utm_medium: 'cypress',
            utm_campaign: 'schedule-conflict',
          });

          const conflictingBooking = await insertOneTolerant('public_bookings', {
            clinic_id: clinic.id,
            service_id: service.id,
            patient_id: null,
            patient_name: `QA Conflict Confirm Booking ${stamp}`,
            patient_email: `confirm-booking-${stamp}@laralis.test`,
            patient_phone: '+15555550312',
            patient_notes: `qa-schedule-conflict ${stamp}`,
            requested_date: date,
            requested_time: '09:30',
            status: 'pending',
            ip_address: '127.0.0.1',
            user_agent: 'laralis-qa',
            referrer: 'cypress',
            utm_source: 'qa',
            utm_medium: 'cypress',
            utm_campaign: 'schedule-conflict',
          });

          return {
            stamp,
            clinicId: clinic.id,
            serviceId: service.id,
            patientId: patient.id,
            treatmentId: treatment.id,
            bookingId: booking.id,
            conflictingBookingId: conflictingBooking.id,
            conflictingBookingEmail: conflictingBooking.patient_email,
            publicBookingAppointmentId: `public_booking:${booking.id}`,
            conflictingPublicBookingAppointmentId: `public_booking:${conflictingBooking.id}`,
            date,
          };
        },

        async qaScheduleConflictCleanup({ stamp }: { stamp?: string }) {
          if (!stamp) return { cleaned: false };

          const client = adminClient();
          const { data: bookings } = await client
            .from('public_bookings')
            .select('id')
            .ilike('patient_name', `%${stamp}%`);
          const bookingIds = (bookings || []).map((row) => row.id).filter(Boolean);

          const { data: treatments } = await client
            .from('treatments')
            .select('id')
            .ilike('notes', `%${stamp}%`);
          const treatmentIds = (treatments || []).map((row) => row.id).filter(Boolean);

          const { data: patients } = await client
            .from('patients')
            .select('id')
            .ilike('email', `%${stamp}%`);
          const patientIds = (patients || []).map((row) => row.id).filter(Boolean);

          await deleteByIds('public_bookings', bookingIds);
          await deleteByIds('treatments', treatmentIds);
          await deleteByIds('patients', patientIds);

          return {
            cleaned: true,
            bookingCount: bookingIds.length,
            treatmentCount: treatmentIds.length,
            patientCount: patientIds.length,
          };
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
