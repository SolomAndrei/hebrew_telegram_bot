import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { Env } from '../../config/env.schema';
import { parseLlmJsonResponse } from '../../llm/llm-json-response';
import { LlmProviderService } from '../../llm/llm-provider.service';
import { stripHebrewMarks } from '../hebrew-transcription';
import {
  SkeletonToken,
  SkeletonWordToken,
  tokenizeHebrewText,
} from '../hebrew-text-tokenizer';
import type {
  AdaptRawTextInput,
  AdaptedTextDraft,
  EnrichedArticleToken,
  EnrichedTextForReading,
  EnrichTextForReadingInput,
  TextAdapterPort,
  ValidateAdaptationInput,
  ValidationResult,
} from '../ports/text-adapter.port';

const adaptedTextSchema = z.object({
  original_summary: z.string(),
  adapted_text: z.string(),
  vocabulary_used: z.array(z.string()).default([]),
});

const wordEnrichmentSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  pointedText: z.string(),
  translationRu: z.string(),
  lemma: z.string(),
});

const wordEnrichmentsSchema = z.object({
  words: z.array(wordEnrichmentSchema),
});

const validationSchema = z.object({
  is_valid: z.boolean(),
  reason: z.string(),
});

type AdaptedTextResponse = z.infer<typeof adaptedTextSchema>;
type WordEnrichmentsResponse = z.infer<typeof wordEnrichmentsSchema>;
type ValidationResponse = z.infer<typeof validationSchema>;
type LlmStage =
  | 'adaptation'
  | 'validation'
  | 'reading_token_enrichment';

@Injectable()
export class LlmTextAdapter implements TextAdapterPort {
  private readonly model: string | undefined;
  private readonly logger = new Logger(LlmTextAdapter.name);

  constructor(
    @Inject(LlmProviderService)
    private readonly llmProvider: LlmProviderService,
    @Inject(ConfigService) configService: ConfigService<Env, true>,
  ) {
    this.model = configService.get('LLM_ADAPTATION_MODEL', { infer: true });
  }

  async adaptRawText(input: AdaptRawTextInput): Promise<AdaptedTextDraft> {
    const system =
      'You adapt Hebrew texts for language learners. Return only valid JSON.';
    const prompt = [
      `Rewrite the Hebrew text for learner level MMR=${input.userLevelScore}.`,
      'Preserve all core facts. Do not invent facts.',
      'Write Hebrew without niqqud.',
      'Use learning words only when they fit the meaning naturally.',
      `Learning words: ${input.learningWords.join(', ') || 'none'}.`,
      'Return JSON with keys: original_summary, adapted_text, vocabulary_used.',
      `Text: ${input.rawText}`,
    ].join('\n');
    const object = await this.generateAdaptedText(system, prompt);

    return {
      originalSummary: object.original_summary,
      adaptedText: object.adapted_text,
      vocabularyUsed: object.vocabulary_used,
    };
  }

  async enrichTextForReading(
    input: EnrichTextForReadingInput,
  ): Promise<EnrichedTextForReading> {
    const skeleton = tokenizeHebrewText(input.adaptedText);
    const wordTokens = skeleton.filter(
      (token): token is SkeletonWordToken => token.type === 'word',
    );
    const textTokenCount = skeleton.length - wordTokens.length;

    this.logger.log(
      `tokenized words=${wordTokens.length} textTokens=${textTokenCount}`,
    );

    if (wordTokens.length === 0) {
      return {
        tokens: skeleton.map((token) => this.toTextToken(token)),
      };
    }

    const system =
      'You enrich Hebrew word tokens for an interactive language-learning reader. Return only valid JSON.';
    const prompt = [
      'You receive the full adapted Hebrew text and a list of word tokens with stable string ids.',
      'Do not split or retokenize the text. Enrich only the provided word ids.',
      'Return exactly one object in words for each provided id.',
      'For each word return: id, pointedText, translationRu, lemma.',
      'id must be the same string id from the input.',
      'pointedText must be the same consonants as text, with niqqud added.',
      'After removing niqqud, pointedText must equal text exactly.',
      'translationRu must be a short Russian translation in this sentence context.',
      'lemma must be a useful Hebrew dictionary lemma without niqqud.',
      'Do not add transcription, part of speech, alternatives, grammar notes, or explanations.',
      'Return JSON with key: words.',
      `Adapted text: ${input.adaptedText}`,
      `Words: ${JSON.stringify(
        wordTokens.map((token) => ({ id: token.id, text: token.text })),
      )}`,
    ].join('\n');

    const enrichments = await this.generateWordEnrichments(system, prompt);
    const enrichmentById = new Map(
      enrichments.words.map((word) => [word.id, word]),
    );

    let matched = 0;
    let missing = 0;
    let pointedMismatch = 0;

    const tokens: EnrichedArticleToken[] = skeleton.map((token) => {
      if (token.type === 'text') {
        return this.toTextToken(token);
      }

      const enrichment = enrichmentById.get(token.id);

      if (!enrichment) {
        missing += 1;
        return {
          type: 'word',
          id: token.id,
          text: token.text,
          pointedText: token.text,
          translationRu: '',
          lemma: token.text,
        };
      }

      const strippedPointedText = stripHebrewMarks(enrichment.pointedText);

      if (strippedPointedText !== token.text) {
        pointedMismatch += 1;
        return {
          type: 'word',
          id: token.id,
          text: token.text,
          pointedText: token.text,
          translationRu: enrichment.translationRu,
          lemma: enrichment.lemma || token.text,
        };
      }

      matched += 1;
      return {
        type: 'word',
        id: token.id,
        text: token.text,
        pointedText: enrichment.pointedText,
        translationRu: enrichment.translationRu,
        lemma: enrichment.lemma || token.text,
      };
    });

    this.logger.log(
      `enrichment merged matched=${matched} missing=${missing} pointedMismatch=${pointedMismatch}`,
    );

    return { tokens };
  }

  async validateAdaptation(
    input: ValidateAdaptationInput,
  ): Promise<ValidationResult> {
    const system = 'You validate Hebrew text adaptations. Return only valid JSON.';
    const prompt = [
      'Compare the original Hebrew text and adapted Hebrew text.',
      'Check whether the main facts are preserved.',
      'Check that there are no hallucinations.',
      'Check that the Hebrew is grammatically correct.',
      'Return JSON with keys: is_valid, reason.',
      `Original: ${input.originalText}`,
      `Adapted: ${input.adaptedText}`,
    ].join('\n');
    const object = await this.generateValidation(system, prompt);

    return {
      isValid: object.is_valid,
      reason: object.reason,
    };
  }

  private toTextToken(token: SkeletonToken): EnrichedArticleToken {
    return {
      type: 'text',
      text: token.text,
    };
  }

  private getModel() {
    if (!this.model) {
      throw new Error('LLM_ADAPTATION_MODEL is required for adaptation');
    }

    return this.llmProvider.getChatModel(this.model);
  }

  private async generateAdaptedText(
    system: string,
    prompt: string,
  ): Promise<AdaptedTextResponse> {
    return this.runLlmStage('adaptation', async () => {
      if (this.llmProvider.getOutputMode() === 'json_schema') {
        const { object } = await generateObject({
          model: this.getModel(),
          schema: adaptedTextSchema,
          system,
          prompt,
        });

        return object;
      }

      return this.generateJsonObject(
        system,
        prompt,
        adaptedTextSchema,
        'Adaptation',
      );
    });
  }

  private async generateWordEnrichments(
    system: string,
    prompt: string,
  ): Promise<WordEnrichmentsResponse> {
    return this.runLlmStage('reading_token_enrichment', async () => {
      if (this.llmProvider.getOutputMode() === 'json_schema') {
        const { object } = await generateObject({
          model: this.getModel(),
          schema: wordEnrichmentsSchema,
          system,
          prompt,
        });

        return object;
      }

      return this.generateJsonObject(
        system,
        prompt,
        wordEnrichmentsSchema,
        'Reading token enrichment',
      );
    });
  }

  private async generateValidation(
    system: string,
    prompt: string,
  ): Promise<ValidationResponse> {
    return this.runLlmStage('validation', async () => {
      if (this.llmProvider.getOutputMode() === 'json_schema') {
        const { object } = await generateObject({
          model: this.getModel(),
          schema: validationSchema,
          system,
          prompt,
        });

        return object;
      }

      return this.generateJsonObject(
        system,
        prompt,
        validationSchema,
        'Adaptation validation',
      );
    });
  }

  private async generateJsonObject<T>(
    system: string,
    prompt: string,
    schema: z.ZodType<T>,
    context: string,
  ): Promise<T> {
    const { text } = await generateText({
      model: this.getModel(),
      system,
      prompt: [
        prompt,
        'Return only one valid JSON object. Do not include markdown fences, explanations, or extra text.',
      ].join('\n'),
    });

    return parseLlmJsonResponse(text, schema, context);
  }

  private async runLlmStage<T>(
    stage: LlmStage,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    const model = this.model ?? 'unset';
    const outputMode = this.llmProvider.getOutputMode();

    this.logger.log(
      `LLM stage started: stage=${stage} model=${model} outputMode=${outputMode}`,
    );

    try {
      const result = await operation();
      this.logger.log(
        `LLM stage succeeded: stage=${stage} model=${model} outputMode=${outputMode} durationMs=${Date.now() - startedAt}`,
      );
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `LLM stage failed: stage=${stage} model=${model} outputMode=${outputMode} durationMs=${Date.now() - startedAt} error=${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
