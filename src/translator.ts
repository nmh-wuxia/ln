export interface ChapterTranslationInput {
  story_title: string;
  chapter_title: string;
  text: string;
}

export interface ChapterTranslationOutput {
  story_title: string;
  chapter_title: string;
  text: string;
}

export interface Translator {
  translate(input: ChapterTranslationInput): Promise<ChapterTranslationOutput>;
}

/* Useful for testing, no-op translation (identity). */
export class MockTranslator implements Translator {
  async translate(
    input: ChapterTranslationInput,
  ): Promise<ChapterTranslationOutput> {
    return {
      story_title: input.story_title,
      chapter_title: input.chapter_title,
      text: input.text,
    };
  }
}

export interface DeepSeekTranslatorOptions {
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

/* Translator that uses DeepSeek's Chat Completions API. */
export class DeepSeekTranslator implements Translator {
  private apiKey: string;
  private model: string;
  private endpoint: string;

  constructor(options: DeepSeekTranslatorOptions = {}) {
    const key = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("DEEPSEEK_API_KEY is not set");
    this.apiKey = key;
    this.model = options.model ?? "deepseek-chat";
    this.endpoint =
      options.endpoint ?? "https://api.deepseek.com/chat/completions";
  }
  async translate(
    input: ChapterTranslationInput,
  ): Promise<ChapterTranslationOutput> {
    // Single prompt format: story title, dashed line, chapter title, dashed line, chapter body
    const messages = [
      {
        role: "system",
        content:
          "You are a professional literary translator. Translate the provided story and chapter to natural English suitable for publication. Return EXACTLY this plaintext format: first line is the translated story title, second line is a line of dashes, third line is the translated chapter title, fourth line is a line of dashes, and the remaining lines are the translated chapter content. No extra commentary.",
      },
      {
        role: "user",
        content:
          "Please translate to English in the specified format.\n" +
          `Original story title:\n${input.story_title}\n` +
          `Original chapter title:\n${input.chapter_title}\n` +
          "Original chapter body:\n\n" +
          `${input.text}`,
      },
    ];
    const raw = await this.callDeepSeek(messages);
    const { storyTitle, chapterTitle, body } = this.parseCombinedPlaintext(raw);
    return { story_title: storyTitle, chapter_title: chapterTitle, text: body };
  }
  private async callDeepSeek(
    messages: { role: string; content: string }[],
  ): Promise<string> {
    const body = { model: this.model, messages, stream: false } as const;
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`DeepSeek API error (${res.status}): ${text}`);
    }
    const data: any = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek API returned no content");
    return content;
  }
  private parseCombinedPlaintext(raw: string): {
    storyTitle: string;
    chapterTitle: string;
    body: string;
  } {
    const lines = raw.replace(/\r\n/g, "\n").split("\n");
    if (lines.length < 5) {
      throw new Error("DeepSeek combined response format invalid (too short)");
    }
    const storyTitle = lines[0]!.trim();
    const firstSep = lines.findIndex((l, i) => i >= 1 && /^-+$/.test(l.trim()));
    if (firstSep !== 1) {
      // Expect the first dashed line immediately after story title for strictness
      throw new Error(
        "DeepSeek combined response missing first dashed separator",
      );
    }
    const chapterTitleLine = firstSep + 1;
    const chapterTitle = (lines[chapterTitleLine] ?? "").trim();
    const secondSep = lines.findIndex(
      (l, i) => i > chapterTitleLine && /^-+$/.test(l.trim()),
    );
    if (secondSep !== chapterTitleLine + 1) {
      throw new Error(
        "DeepSeek combined response missing second dashed separator",
      );
    }
    const body = lines
      .slice(secondSep + 1)
      .join("\n")
      .trim();
    if (!storyTitle) throw new Error("DeepSeek returned empty story title");
    if (!chapterTitle || !body)
      throw new Error(
        "DeepSeek combined response missing chapter title or body",
      );
    return { storyTitle, chapterTitle, body };
  }
}
