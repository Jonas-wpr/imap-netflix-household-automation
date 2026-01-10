import { existsSync } from "fs";
import { chromium, expect } from '@playwright/test';
import Errorlogger from './Errorlogger';
import Logger from './Logger';

const STORAGE_STATE_PATH = './tmp/storageState.json';

export default async function playwrightAutomation(url: string) {
  Logger.info('Starting browser automation...');
  
  const storageStateExists = existsSync(STORAGE_STATE_PATH);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-gl-drawing-for-tests',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-sandbox',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
    ],
  });

  const browserContext = await browser.newContext({
    storageState: storageStateExists ? STORAGE_STATE_PATH : undefined,
    javaScriptEnabled: true,
    hasTouch: false,
    isMobile: false,
    reducedMotion: 'reduce',
  });

  await browserContext.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    const blockedTypes = ['image', 'media', 'font'];

    if (blockedTypes.includes(resourceType)) {
      return route.abort();
    }
    return route.continue();
  });

  const page = await browserContext.newPage();

  try {
    Logger.info('Opening Netflix link...');
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    await expect(async () => {
      const updatePrimaryButton = page.locator("button[data-uia='set-primary-location-action']");
      await updatePrimaryButton.click({ force: true });

      const isSuccessLocator = page.locator('div[data-uia="upl-success"]');
      await expect(isSuccessLocator).toBeAttached({ timeout: 1000 });
    }).toPass({
      intervals: [100, 250, 500, 1_000],
      timeout: 30_000,
    });

    await browserContext.storageState({ path: STORAGE_STATE_PATH });
    Logger.success('Household location updated successfully!');
  } catch (error) {
    throw new Errorlogger(`Netflix update failed for (${url}): ${error}`);
  } finally {
    await browser.close();
  }
}
