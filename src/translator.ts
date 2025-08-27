export interface Translator {
  translateChapter(input: { title: string; body: string }): Promise<{ title: string; body: string }>;
}

export class MockTranslator implements Translator {
  async translateChapter(input: { title: string; body: string }): Promise<{ title: string; body: string }> {
    return input;
  }
}

export class DeepSeekTranslator implements Translator {
  apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  async translateChapter(input: { title: string; body: string }): Promise<{ title: string; body: string }> {
    const resp = await fetch("https://api.deepseek.com/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(input),
    });
    return (await resp.json()) as { title: string; body: string };
  }
}
