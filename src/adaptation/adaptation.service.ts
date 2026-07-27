import { Inject, Injectable } from '@nestjs/common';

import {
  AdaptRawTextInput,
  AdaptedTextDraft,
  TEXT_ADAPTER_PORT,
  TextAdapterPort,
} from './ports/text-adapter.port';

export type AdaptedTextResult = AdaptedTextDraft & {
  isValidated: boolean;
};

@Injectable()
export class AdaptationService {
  constructor(
    @Inject(TEXT_ADAPTER_PORT)
    private readonly textAdapter: TextAdapterPort,
  ) {}

  async adaptRawText(input: AdaptRawTextInput): Promise<AdaptedTextResult> {
    const maxAttempts = 3;
    let lastDraft: AdaptedTextDraft | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const draft = await this.textAdapter.adaptRawText(input);
      lastDraft = draft;

      const validation = await this.textAdapter.validateAdaptation({
        originalText: input.rawText,
        adaptedText: draft.adaptedText,
      });

      if (validation.isValid) {
        return {
          ...draft,
          isValidated: true,
        };
      }
    }

    if (!lastDraft) {
      throw new Error('Failed to generate adapted text');
    }

    return {
      ...lastDraft,
      isValidated: false,
    };
  }
}
