// Browser tests: the built page is one file, and seek(t) alone decides the frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHtml } from '../build.mjs';
import { launch, openPage } from '../render/capture.mjs';

test('built page is a single self-contained HTML file', async () => {
  const html = readFileSync(await buildHtml(), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+stylesheet|url\((?!data:|#)/);
});

test('seek(t) is deterministic regardless of the order frames are visited', async () => {
  const browser = await launch();
  try {
    const { shot } = await openPage(browser, await buildHtml(), { scale: .25, fast: false });
    for (const t of [1.2, 4.6, 7.6, 12.4, 15.4, 18.9]) {
      const a = await shot(t);
      await shot(19.9 - t);          // visit somewhere else in between
      const b = await shot(t);
      assert.ok(a.equals(b), `frame at ${t}s differs on revisit`);
    }
  } finally { await browser.close(); }
});
