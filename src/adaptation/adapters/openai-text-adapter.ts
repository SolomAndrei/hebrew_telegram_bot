import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';

import { Env } from '../../config/env.schema';
import type {
  AdaptRawTextInput,
  AdaptedTextDraft,
  TextAdapterPort,
  ValidateAdaptationInput,
  ValidationResult,
} from '../ports/text-adapter.port';

const adaptedTextSchema = z.object({
  original_summary: z.string(),
  adapted_title: z.string(),
  adapted_text: z.string(),
  vocabulary_used: z.array(z.string()).default([]),
});

const validationSchema = z.object({
  is_valid: z.boolean(),
  reason: z.string(),
});

@Injectable()
export class OpenAiTextAdapter implements TextAdapterPort {
  private readonly client: OpenAI | undefined;

  constructor(@Inject(ConfigService) configService: ConfigService<Env, true>) {
    const apiKey = configService.get('OPENAI_API_KEY', { infer: true });

    this.client = apiKey ? new OpenAI({ apiKey }) : undefined;
  }

  async adaptRawText(input: AdaptRawTextInput): Promise<AdaptedTextDraft> {
    const content = await this.createJsonCompletion([
      {
        role: 'system',
        content:
          'You adapt Hebrew texts for language learners. Return only valid JSON.',
      },
      {
        role: 'user',
        content: [
          `Rewrite the Hebrew text for learner level MMR=${input.userLevelScore}.`,
          'Preserve all core facts. Do not invent facts.',
          'Write Hebrew without niqqud.',
          'Use learning words only when they fit the meaning naturally.',
          `Learning words: ${input.learningWords.join(', ') || 'none'}.`,
          'Return JSON with keys: original_summary, adapted_title, adapted_text, vocabulary_used.',
          `Text: ${input.rawText}`,
        ].join('\n'),
      },
    ]);

    const parsed = adaptedTextSchema.parse(JSON.parse(content));

    return {
      originalSummary: parsed.original_summary,
      adaptedTitle: parsed.adapted_title,
      adaptedText: parsed.adapted_text,
      vocabularyUsed: parsed.vocabulary_used,
    };
  }

  async validateAdaptation(
    input: ValidateAdaptationInput,
  ): Promise<ValidationResult> {
    const content = await this.createJsonCompletion([
      {
        role: 'system',
        content:
          'You validate Hebrew text adaptations. Return only valid JSON.',
      },
      {
        role: 'user',
        content: [
          'Compare the original Hebrew text and adapted Hebrew text.',
          'Check whether the main facts are preserved.',
          'Check that there are no hallucinations.',
          'Check that the Hebrew is grammatically correct.',
          'Return JSON with keys: is_valid, reason.',
          `Original: ${input.originalText}`,
          `Adapted: ${input.adaptedText}`,
        ].join('\n'),
      },
    ]);

    const parsed = validationSchema.parse(JSON.parse(content));

    return {
      isValid: parsed.is_valid,
      reason: parsed.reason,
    };
  }

  private async createJsonCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OPENAI_API_KEY is required for adaptation');
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
