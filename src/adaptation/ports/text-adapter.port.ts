import type {
  TextArticleToken,
  WordArticleToken,
} from '../../mini-app/mini-app-api.contracts';

export const TEXT_ADAPTER_PORT = Symbol('TEXT_ADAPTER_PORT');

export type AdaptRawTextInput = {
  rawText: string;
  userLevelScore: number;
  learningWords: string[];
};

export type AdaptedTextDraft = {
  originalSummary: string;
  adaptedText: string;
  vocabularyUsed: string[];
};

export type EnrichTextForReadingInput = {
  adaptedText: string;
};

export type EnrichedWordArticleToken = Omit<
  WordArticleToken,
  'transcriptionRu'
>;

export type EnrichedArticleToken =
  | EnrichedWordArticleToken
  | TextArticleToken;

export type EnrichedTextForReading = {
  tokens: EnrichedArticleToken[];
};

export type ValidateAdaptationInput = {
  originalText: string;
  adaptedText: string;
};

export type ValidationResult = {
  isValid: boolean;
  reason: string;
};

export interface TextAdapterPort {
  adaptRawText(input: AdaptRawTextInput): Promise<AdaptedTextDraft>;
  enrichTextForReading(
    input: EnrichTextForReadingInput,
  ): Promise<EnrichedTextForReading>;
  validateAdaptation(input: ValidateAdaptationInput): Promise<ValidationResult>;
}
