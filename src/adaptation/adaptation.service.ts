import { Inject, Injectable, Logger } from '@nestjs/common';

import type { ArticleToken } from '../mini-app/mini-app-api.contracts';
import {
  stripHebrewMarks,
  transcribeHebrewToRussian,
} from './hebrew-transcription';
import {
  AdaptRawTextInput,
  AdaptedTextDraft,
  TEXT_ADAPTER_PORT,
  TextAdapterPort,
} from './ports/text-adapter.port';

export type AdaptedTextResult = AdaptedTextDraft & {
  tokens: ArticleToken[];
  isValidated: boolean;
};

export class AdaptationValidationFailedError extends Error {
  constructor(readonly reason: string | undefined) {
    super(
      reason
        ? `Adaptation validation failed: ${reason}`
        : 'Adaptation validation failed',
    );
    this.name = AdaptationValidationFailedError.name;
  }
}

@Injectable()
export class AdaptationService {
  private readonly logger = new Logger(AdaptationService.name);

  constructor(
    @Inject(TEXT_ADAPTER_PORT)
    private readonly textAdapter: TextAdapterPort,
  ) {}

  async adaptRawText(input: AdaptRawTextInput): Promise<AdaptedTextResult> {
    const maxAttempts = 3;
    let lastDraft: AdaptedTextDraft | undefined;
    let lastValidationReason: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      this.logger.log(
        `Adaptation attempt ${attempt}/${maxAttempts}: textLength=${input.rawText.length} level=${input.userLevelScore}`,
      );

      const draft = await this.textAdapter.adaptRawText(input);
      lastDraft = draft;

      const validation = await this.textAdapter.validateAdaptation({
        originalText: input.rawText,
        adaptedText: draft.adaptedText,
      });

      if (validation.isValid) {
        this.logger.log(
          `Adaptation validated on attempt ${attempt}; enriching reading tokens`,
        );

        const enriched = await this.enrichWithRetry(draft.adaptedText);

        return {
          ...draft,
          tokens: enriched.tokens.map((token) =>
            this.toReadableWordToken(token),
          ),
          isValidated: true,
        };
      }

      lastValidationReason = validation.reason;
      this.logger.warn(
        `Adaptation validation rejected attempt ${attempt}/${maxAttempts}: ${validation.reason ?? 'no reason'}`,
      );
    }

    if (!lastDraft) {
      throw new Error('Failed to generate adapted text');
    }

    throw new AdaptationValidationFailedError(lastValidationReason);
  }

  private async enrichWithRetry(adaptedText: string) {
    const maxEnrichAttempts = 2;
    let lastError: unknown;

    for (
      let enrichAttempt = 1;
      enrichAttempt <= maxEnrichAttempts;
      enrichAttempt += 1
    ) {
      try {
        return await this.textAdapter.enrichTextForReading({ adaptedText });
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Reading token enrichment failed on attempt ${enrichAttempt}/${maxEnrichAttempts}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to enrich reading tokens');
  }

  private toReadableWordToken(
    token: Awaited<
      ReturnType<TextAdapterPort['enrichTextForReading']>
    >['tokens'][number],
  ): ArticleToken {
    if (token.type !== 'word') {
      return token;
    }

    const strippedPointedText = stripHebrewMarks(token.pointedText);

    if (strippedPointedText !== token.text) {
      this.logger.warn(
        `Pointed Hebrew token does not match source token; falling back to unpointed text. text=${token.text} pointedText=${token.pointedText}`,
      );

      return {
        ...token,
        pointedText: token.text,
        transcriptionRu: '',
      };
    }

    return {
      ...token,
      transcriptionRu: transcribeHebrewToRussian({
        text: token.text,
        pointedText: token.pointedText,
      }),
    };
  }
}
