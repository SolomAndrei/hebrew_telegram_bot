import { Inject, Injectable, Logger } from '@nestjs/common';

import type { ArticleToken } from '../mini-app/mini-app-api.contracts';
import { transcribeHebrewToRussian } from './hebrew-transcription';
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

        const enriched = await this.textAdapter.enrichTextForReading({
          adaptedText: draft.adaptedText,
        });

        return {
          ...draft,
          tokens: enriched.tokens.map((token) =>
            token.type === 'word'
              ? {
                  ...token,
                  transcriptionRu: transcribeHebrewToRussian({
                    text: token.text,
                    pointedText: token.pointedText,
                  }),
                }
              : token,
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
}
