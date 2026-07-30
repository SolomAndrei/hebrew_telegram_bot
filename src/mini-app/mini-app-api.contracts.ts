export type MeResponse = {
  telegramId: number;
  currentLevelScore: number;
  learningWordsCount: number;
};

export type UpdateLevelRequest = {
  currentLevelScore: number;
};

export type WordArticleToken = {
  type: 'word';
  id: string;
  text: string;
  pointedText: string;
  transcriptionRu: string;
  translationRu: string;
  lemma: string;
};

export type TextArticleToken = {
  type: 'text';
  text: string;
};

export type ArticleToken = WordArticleToken | TextArticleToken;

export type ArticleForReadingResponse = {
  id: string;
  difficultyScore: number;
  tokens: ArticleToken[];
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
