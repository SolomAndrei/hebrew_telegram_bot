export const WORD_ANALYSIS_PORT = Symbol('WORD_ANALYSIS_PORT');

export type AnalyzeWordInput = {
  word: string;
  sentenceContext: string;
};

export type AnalyzeWordResult = {
  contextTranslationRu: string;
  transcriptionRu: string;
  lemma: string;
  partOfSpeech: string;
  baseFormReason: string;
  alternatives: string[];
};

export interface WordAnalysisPort {
  analyzeWord(input: AnalyzeWordInput): Promise<AnalyzeWordResult>;
}
