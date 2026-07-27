export const USERS_REPOSITORY_PORT = Symbol('USERS_REPOSITORY_PORT');

export type User = {
  id: string;
  telegramId: number;
  currentLevelScore: number;
};

export type LearningWord = {
  lemma: string;
};

export type UpsertLearningWordInput = {
  userId: string;
  lemma: string;
  originalWord: string;
  partOfSpeech: string;
};

export type SaveReadingStatsInput = {
  userId: string;
  articleId: string;
  generatedWordsCount: number;
  translationRequestsCount: number;
};

export interface UsersRepositoryPort {
  findOrCreateByTelegramId(telegramId: number): Promise<User>;
  getProfileByTelegramId(telegramId: number): Promise<User>;
  getLearningWords(userId: string): Promise<LearningWord[]>;
  getLearningWordsCount(userId: string): Promise<number>;
  upsertLearningWord(input: UpsertLearningWordInput): Promise<void>;
  saveReadingStats(input: SaveReadingStatsInput): Promise<void>;
  updateLevelByTelegramId(
    telegramId: number,
    currentLevelScore: number,
  ): Promise<User>;
}
