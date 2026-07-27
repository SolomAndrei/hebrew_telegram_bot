import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';

import { Env } from '../../config/env.schema';
import type {
  AnalyzeWordInput,
  AnalyzeWordResult,
  WordAnalysisPort,
} from '../ports/word-analysis.port';

const wordAnalysisSchema = z.object({
  contextTranslationRu: z.string(),
  transcriptionRu: z.string(),
  lemma: z.string(),
  partOfSpeech: z.string(),
  baseFormReason: z.string(),
  alternatives: z.array(z.string()).default([]),
});

@Injectable()
export class OpenAiWordAnalysisAdapter implements WordAnalysisPort {
  private readonly client: OpenAI | undefined;

  constructor(@Inject(ConfigService) configService: ConfigService<Env, true>) {
    const apiKey = configService.get('OPENAI_API_KEY', { infer: true });

    this.client = apiKey ? new OpenAI({ apiKey }) : undefined;
  }

  async analyzeWord(input: AnalyzeWordInput): Promise<AnalyzeWordResult> {
    const content = await this.createJsonCompletion([
      {
        role: 'system',
        content:
          'You analyze Hebrew words for language learners. Return only valid JSON.',
      },
      {
        role: 'user',
        content: [
          'Analyze the selected Hebrew word in its sentence context.',
          'Return Russian translation and Russian phonetic transcription.',
          'Normalize the word to a useful dictionary lemma.',
          'Do not add facts that are not implied by the sentence.',
          'Return JSON with keys: contextTranslationRu, transcriptionRu, lemma, partOfSpeech, baseFormReason, alternatives.',
          `Word: ${input.word}`,
          `Sentence context: ${input.sentenceContext}`,
        ].join('\n'),
      },
    ]);

    return wordAnalysisSchema.parse(JSON.parse(content));
  }

  private async createJsonCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OPENAI_API_KEY is required for word analysis');
    }

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: {
        type: 'json_object',
      },
      messages,
    });

    const content = response.choices[0]?.message.content;

    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    return content;
  }
}
