// Browser smoke test: loads the generator, builds a part, downloads every file type.
// Run: npm run test:e2e   (CI installs Chromium; locally it falls back to installed Chrome)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../../scripts/serve.js';

const PORT = 8790;
const server = await serve(PORT);
let browser;
try {
  browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`http://localhost:${PORT}/#t=hopper&x=2&y=3&h=7&w=std&s=0.6&f=0.4`);
  await page.waitForFunction(() => /\d+ g/.test(document.getElementById('statGrams').textContent), null, { timeout: 60000 });
  assert.equal(await page.textContent('#hudName'), 'AESS-HOP-2x3x7-STD');

  const grab = async (selector) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(selector)]);
    return dl.suggestedFilename();
  };
  assert.equal(await grab('#dl3mf'), 'AESS-HOP-2x3x7-STD.3mf');
  assert.equal(await grab('#dlStl'), 'AESS-HOP-2x3x7-STD.stl');

  await page.click('.typecard[data-type=box]');
  await page.click('#addPlate');
  await page.click('#addLid');
  await page.waitForFunction(() => document.getElementById('plateTotal').textContent.startsWith('2 parts'));
  assert.equal(await grab('#dlPlate'), 'AESS-plate-2-parts.3mf');
  assert.equal(await grab('#dlZip'), 'AESS-parts-stl.zip');

  const mobile = await browser.newPage({ viewport: { width: 375, height: 740 } });
  await mobile.goto(`http://localhost:${PORT}/`);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll on phones');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('e2e smoke: ok');
} finally {
  await browser?.close();
  server.close();
}
