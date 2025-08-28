#!/usr/bin/env node
// Simple CLI to translate a chapter using DeepSeek in one request.
// Usage: node scripts/deepseek-translate.mjs input.json > output.json

import fs from 'node:fs/promises';
const DIST_TRANSLATOR = new URL('../dist/translator.js', import.meta.url).pathname;

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Error: DEEPSEEK_API_KEY is not set');
    process.exit(1);
  }
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/deepseek-translate.mjs <input.json>');
    process.exit(1);
  }

  const raw = await fs.readFile(inputPath, 'utf8');
  /** @type {{story_title?: string, chapter_title?: string, text?: string, body?: string}} */
  const data = JSON.parse(raw);
  const storyTitle = data.story_title ?? data.story ?? '';
  const chapterTitle = data.chapter_title ?? data.chapter ?? '';
  const body = data.text ?? data.body ?? '';
  if (!storyTitle || !chapterTitle || !body) {
    console.error('Error: input JSON must contain story_title, chapter_title, and text (or body)');
    process.exit(1);
  }

  // Load translator from built JS
  let TranslatorMod;
  try {
    TranslatorMod = await import(DIST_TRANSLATOR);
  } catch (e) {
    console.error('Error: could not load dist/translator.js. Run `npm run build` first.');
    process.exit(1);
  }
  const { DeepSeekTranslator } = TranslatorMod;

  const translator = new DeepSeekTranslator({ apiKey });

  const translated = await translator.translate({
    story_title: storyTitle,
    chapter_title: chapterTitle,
    text: body,
  });
  process.stdout.write(JSON.stringify(translated, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
