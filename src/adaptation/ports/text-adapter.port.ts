export const TEXT_ADAPTER_PORT = Symbol('TEXT_ADAPTER_PORT');

export type AdaptRawTextInput = {
  rawText: string;
  userLevelScore: number;
  learningWords: string[];
};

export type AdaptedTextDraft = {
  originalSummary: string;
  adaptedTitle: string;
  adaptedText: string;
  vocabularyUsed: string[];
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
  validateAdaptation(input: ValidateAdaptationInput): Promise<ValidationResult>;
}
