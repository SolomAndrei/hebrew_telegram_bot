export type MeResponse = {
  telegramId: number;
  currentLevelScore: number;
  learningWordsCount: number;
};

export type UpdateLevelRequest = {
  currentLevelScore: number;
};

export type ArticleForReadingResponse = {
  id: string;
  title: string;
  adaptedText: string;
  difficultyScore: number;
};

export type TranslateWordRequest = {
  articleId: string;
  word: string;
  sentenceContext: string;
};

export type TranslateWordResponse = {
  contextTranslationRu: string;
  transcriptionRu: string;
  lemma: string;
  partOfSpeech: string;
  baseFormReason: string;
  alternatives: string[];
  learningWordsCount: number;
};

export type FinishReadingSessionRequest = {
  articleId: string;
  generatedWordsCount: number;
  translationRequestsCount: number;
  translatedLemmas: string[];
};

export type FinishReadingSessionResponse = {
  currentLevelScore: number;
  levelChanged: boolean;
  learningWordsCount: number;
};
