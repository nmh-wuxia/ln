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
