#!/usr/bin/env node
// Usage: node scripts/summarize.mjs input.json summarize_prompt.json translate_prompt.json
import fs from "node:fs/promises";

const configs = {
  CHATGPT_NANO: {
    env_var: "CHATGPT_API_KEY",
    model: "gpt-5-nano",
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  CHATGPT_MINI: {
    env_var: "CHATGPT_API_KEY",
    model: "gpt-5-mini",
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  DEEPSEEK: {
    env_var: "DEEPSEEK_API_KEY",
    model: "deepseek-chat",
    endpoint: "https://api.deepseek.com/chat/completions",
  },
};
let config = configs.DEEPSEEK;
let apiKey = process.env[config.env_var];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function main() {
  if (!apiKey) {
    console.error("Error: API_KEY is not set");
    process.exit(1);
  }
  const inputPath = process.argv[2];
  const summarizePromptPath = process.argv[3];
  const translatePromptPath = process.argv[4];
  const smoothPromptPath = process.argv[5];
  if (
    !inputPath ||
    !summarizePromptPath ||
    !translatePromptPath ||
    !smoothPromptPath
  ) {
    console.error(
      "Usage: node scripts/summarize.mjs <raw_text.json> <summarize_pr.json> <translate_pr.json> <smooth_pr.json>",
    );
    process.exit(1);
  }

  const raw = await fs.readFile(inputPath, "utf8");
  const data = JSON.parse(raw);
  const summarizeRaw = await fs.readFile(summarizePromptPath, "utf8");
  const summarizePrompt = JSON.parse(summarizeRaw);
  const translateRaw = await fs.readFile(translatePromptPath, "utf8");
  const translatePrompt = JSON.parse(translateRaw);
  const smoothRaw = await fs.readFile(smoothPromptPath, "utf8");
  const smoothPrompt = JSON.parse(smoothRaw);

  config = configs.DEEPSEEK;
  apiKey = process.env[config.env_var];
  let messages = summarizePrompt;
  messages[1].content.text_cn = data.text;
  messages[1].content = JSON.stringify(messages[1].content);
  let body = {
    model: config.model,
    stream: false,
    messages: messages,
  };
  let res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek API error (${res.status}): ${text}`);
  }
  let summaryData = {};
  const summary_result = (await res.json()).choices[0].message.content;
  try {
    summaryData = JSON.parse(summary_result);
    fs.writeFile("summary.json", JSON.stringify(summaryData, null, 2));
  } catch (e) {
    console.log("Summary parse failed");
    fs.writeFile("failed.json", summary_result);
  }
  console.log("Done with summarize");

  config = configs.DEEPSEEK;
  apiKey = process.env[config.env_var];
  let responses = [];
  let resp = null;
  try {
    messages = translatePrompt;
    messages[1].content = {
      ...summaryData,
      title: data.chapter_title,
      TASK: messages[1].content.TASK,
      CONSTRAINTS: messages[1].content.CONSTRAINTS,
      READ_ONLY_DATA: messages[1].content.READ_ONLY_DATA,
    };
    const segmenter = new Intl.Segmenter("zh", { granularity: "sentence" });
    let segments = [];
    let i = 0;
    for (const { segment, index } of segmenter.segment(data.text)) {
      if (segment.trim().length == 0) {
        i++;
        continue;
      }
      segments.push({
        sid: i,
        segment: segment,
        start: index,
        end: i + segment.length,
      });
      i++;
    }
    for (let i = 0; i < segments.length; ++i) {
      messages[1].content.READ_ONLY_DATA.prev = segments.slice(
        Math.max(0, i - 3),
        i,
      );
      messages[1].content.READ_ONLY_DATA.next = segments.slice(
        i + 1,
        Math.min(segments.length, i + 2 + 1),
      );
      messages[1].content.seg = {
        sid: segments[i].sid,
        segment: segments[i].segment,
      };
      let body_messages = structuredClone(messages);
      body_messages[1].content = JSON.stringify(messages[1].content);
      body = {
        model: config.model,
        stream: false,
        messages: body_messages,
      };
      res = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API error (${res.status}): ${text}`);
      }
      resp = (await res.json()).choices[0].message.content;
      try {
        responses.push(JSON.parse(resp));
      } catch (e) {
        responses.push(resp);
        console.log("Response parse failed");
      }
      await sleep(500);
    }
    fs.writeFile("responses.json", JSON.stringify(responses, null, 2));
  } catch (e) {
    fs.writeFile("responses.json", JSON.stringify(responses, null, 2));
    console.log("Translate failed: ", e);
  }
  console.log("Done with translate");

  config = configs.CHATGPT_MINI;
  apiKey = process.env[config.env_var];
  messages = smoothPrompt;
  messages[1].content.BIBLE.glossary = summaryData.glossary;
  messages[1].content.BIBLE.glossary_candidates =
    summaryData.glossary_candidates;
  messages[1].content.BIBLE.style_hints =
    summaryData.tone + summaryData.style_hints;
  console.log("num responses: ", responses.length);
  console.log("example response: ", responses[0]);
  messages[1].content.segs = responses;
  messages[1].content = JSON.stringify(messages[1].content);
  body = {
    model: config.model,
    stream: false,
    messages: messages,
  };
  res = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error (${res.status}): ${text}`);
  }
  const test = await res.json();
  console.log("test: ", test);
  const result = test.choices[0].message.content;
  try {
    fs.writeFile("output.json", JSON.stringify(JSON.parse(result), null, 2));
  } catch (e) {
    fs.writeFile("output.json", JSON.stringify(result, null, 2));
    console.log("Smooth parse failed");
  }
  console.log("Done with smooth");
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
