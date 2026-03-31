/**
 * Capture screenshots from the live deployed OpenShift Pulse instance.
 *
 * Usage:
 *   npx playwright test scripts/capture-screenshots.ts
 *
 * Or directly:
 *   npx tsx scripts/capture-screenshots.ts
 *
 * Environment:
 *   PULSE_URL  — base URL (default: reads from `oc get route`)
 *   PULSE_USER — cluster username (default: cluster-admin)
 *   PULSE_PASS — cluster password (required for OAuth login)
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

interface Page {
  name: string;
  path: string;
  /** CSS selector to wait for before capturing — ensures data is loaded */
  waitFor: string;
  /** Extra wait in ms after selector appears (for animations/renders) */
  extraWait?: number;
}

const PAGES: Page[] = [
  { name: 'welcome', path: '/welcome', waitFor: 'text=OpenShift Pulse', extraWait: 2000 },
  { name: 'pulse', path: '/pulse', waitFor: 'text=Cluster Pulse', extraWait: 3000 },
  { name: 'workloads', path: '/workloads', waitFor: 'text=Workloads', extraWait: 2000 },
  { name: 'compute', path: '/compute', waitFor: 'text=Compute', extraWait: 2000 },
  { name: 'storage', path: '/storage', waitFor: 'text=Storage', extraWait: 2000 },
  { name: 'networking', path: '/networking', waitFor: 'text=Networking', extraWait: 2000 },
  { name: 'security', path: '/security', waitFor: 'text=Security', extraWait: 2000 },
  { name: 'admin', path: '/admin', waitFor: 'text=Administration', extraWait: 2000 },
  { name: 'incidents', path: '/incidents', waitFor: 'text=Incident Center', extraWait: 2000 },
  { name: 'reviews', path: '/reviews', waitFor: 'text=Review Queue', extraWait: 2000 },
  { name: 'fleet', path: '/fleet', waitFor: 'text=Fleet', extraWait: 2000 },
  { name: 'onboarding', path: '/onboarding', waitFor: 'text=Production Readiness', extraWait: 2000 },
  { name: 'identity', path: '/identity', waitFor: 'text=Identity', extraWait: 2000 },
  { name: 'gitops', path: '/gitops', waitFor: 'text=GitOps', extraWait: 2000 },
  { name: 'alerts', path: '/incidents?tab=alerts', waitFor: 'text=Incident Center', extraWait: 2000 },
  { name: 'builds', path: '/workloads?tab=builds', waitFor: 'text=Workloads', extraWait: 2000 },
];

async function getBaseUrl(): Promise<string> {
  if (process.env.PULSE_URL) return process.env.PULSE_URL;
  try {
    const route = execSync(
      'oc get route openshiftpulse -n openshiftpulse -o jsonpath="{.spec.host}"',
      { encoding: 'utf-8' },
    ).trim().replace(/"/g, '');
    return `https://${route}`;
  } catch {
    throw new Error('Set PULSE_URL or ensure oc is logged in with a route available');
  }
}

async function login(page: any, baseUrl: string) {
  const user = process.env.PULSE_USER || 'cluster-admin';
  const pass = process.env.PULSE_PASS;
  if (!pass) {
    throw new Error('PULSE_PASS is required for OAuth login');
  }

  console.log(`  Logging in as ${user}...`);
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // OAuth login page — click the htpasswd/kube:admin identity provider
  try {
    // Look for login form or IDP selection
    const idpButton = page.locator('a:has-text("htpasswd"), a:has-text("kube"), a:has-text("cluster"), button:has-text("Log in")').first();
    if (await idpButton.isVisible({ timeout: 5000 })) {
      await idpButton.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // May already be on the login form
  }

  // Fill credentials
  try {
    await page.fill('input[name="username"], #inputUsername', user, { timeout: 5000 });
    await page.fill('input[name="password"], #inputPassword', pass);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });
    console.log('  Logged in successfully');
  } catch (e) {
    // May already be logged in (session cookie)
    console.log('  Already logged in or login skipped');
  }

  // Wait for app to load
  await page.waitForTimeout(3000);
}

async function main() {
  const baseUrl = await getBaseUrl();
  console.log(`Base URL: ${baseUrl}`);
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    args: ['--ignore-certificate-errors'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // Login once
  await login(page, baseUrl);

  // Navigate to welcome first to let the app initialize
  await page.goto(`${baseUrl}/welcome`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Capture each page
  for (const p of PAGES) {
    const url = `${baseUrl}${p.path}`;
    const outFile = path.join(SCREENSHOT_DIR, `${p.name}.png`);

    process.stdout.write(`  Capturing ${p.name}...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForSelector(p.waitFor, { timeout: 10000 });
      await page.waitForTimeout(p.extraWait || 2000);

      // Wait for skeleton loaders to disappear
      try {
        await page.waitForFunction(
          () => document.querySelectorAll('.animate-pulse').length === 0,
          { timeout: 8000 },
        );
      } catch {
        // Some skeletons may persist — that's OK
      }

      await page.screenshot({ path: outFile, fullPage: false });
      const size = fs.statSync(outFile).size;
      console.log(` ${(size / 1024).toFixed(0)}KB`);
    } catch (e: any) {
      console.log(` FAILED: ${e.message}`);
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to docs/screenshots/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
