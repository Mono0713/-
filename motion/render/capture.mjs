// Browser side: open the built page and turn seek(t) into PNG screenshots.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

export const launch = () => chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars'] });

/**
 * Open `htmlPath` in render mode. Returns shot(t) -> PNG Buffer, and the piece's duration.
 * `fast` uses Chromium's quick PNG encoder, whose bytes can vary for identical pixels;
 * pass fast: false when comparing screenshots byte for byte.
 */
export async function openPage(browser, htmlPath, { scale = 1, fast = true } = {}) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(htmlPath).href + '?render');
  await page.evaluate(() => window.ready);
  const cdp = await page.context().newCDPSession(page);
  const shot = async t => {
    await page.evaluate(t => window.seek(t), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: fast });
    return Buffer.from(data, 'base64');
  };
  return { page, shot, duration: await page.evaluate(() => window.DURATION) };
}
