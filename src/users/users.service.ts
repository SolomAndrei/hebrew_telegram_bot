import { Inject, Injectable } from '@nestjs/common';

import type {
  FinishReadingSessionRequest,
  FinishReadingSessionResponse,
} from '../mini-app/mini-app-api.contracts';
import {
  LearningWord,
  UpsertLearningWordInput,
  User,
  USERS_REPOSITORY_PORT,
  UsersRepositoryPort,
} from './ports/users-repository.port';

export const MIN_CURRENT_LEVEL_SCORE = 100;
export const MAX_CURRENT_LEVEL_SCORE = 1000;
const LEVEL_SCORE_STEP = 25;
const EASY_DIFFICULTY_RATIO = 0.05;
const HARD_DIFFICULTY_RATIO = 0.25;

export type UserProfile = {
  telegramId: number;
  currentLevelScore: number;
  learningWordsCount: number;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY_PORT)
    private readonly usersRepository: UsersRepositoryPort,
  ) {}

  findOrCreateByTelegramId(telegramId: number): Promise<User> {
    return this.usersRepository.findOrCreateByTelegramId(telegramId);
  }

  async getProfileByTelegramId(telegramId: number): Promise<UserProfile> {
    const user = await this.usersRepository.getProfileByTelegramId(telegramId);
    const learningWordsCount = await this.getLearningWordsCount(user.id);

    return {
      telegramId: user.telegramId,
      currentLevelScore: user.currentLevelScore,
      learningWordsCount,
    };
  }

  getLearningWords(userId: string): Promise<LearningWord[]> {
    return this.usersRepository.getLearningWords(userId);
  }

  getLearningWordsCount(userId: string): Promise<number> {
    return this.usersRepository.getLearningWordsCount(userId);
  }

  async saveLearningWord(input: UpsertLearningWordInput): Promise<number> {
    await this.usersRepository.upsertLearningWord(input);

    return this.getLearningWordsCount(input.userId);
  }

  async saveLearningWordsFromLemmas(
    userId: string,
    translatedLemmas: string[],
  ): Promise<number> {
    const uniqueLemmas = [...new Set(translatedLemmas)]
      .map((lemma) => lemma.trim())
      .filter(Boolean);

    await Promise.all(
      uniqueLemmas.map((lemma) =>
        this.usersRepository.upsertLearningWord({
          userId,
          lemma,
          originalWord: lemma,
          partOfSpeech: 'unknown',
        }),
      ),
    );

    return this.getLearningWordsCount(userId);
  }

  async updateExposuresAfterReading(
    userId: string,
    adaptedText: string,
    translatedLemmas: string[],
  ): Promise<number> {
    const learningWords = await this.getLearningWords(userId);
    const translatedLemmaSet = new Set(translatedLemmas);
    const shownLemmas = learningWords
      .map((word) => word.lemma)
      .filter(
        (lemma) =>
          !translatedLemmaSet.has(lemma) && this.containsLemma(adaptedText, lemma),
      );

    await this.usersRepository.updateLearningWordExposures({
      userId,
      lemmas: shownLemmas,
    });

    return this.getLearningWordsCount(userId);
  }

  async finishReadingSession(
    user: User,
    input: FinishReadingSessionRequest,
  ): Promise<FinishReadingSessionResponse> {
    await this.usersRepository.saveReadingStats({
      userId: user.id,
      articleId: input.articleId,
      generatedWordsCount: input.generatedWordsCount,
      translationRequestsCount: input.translationRequestsCount,
    });

    const nextLevelScore = this.calculateNextLevelScore(
      user.currentLevelScore,
      input.generatedWordsCount,
      input.translationRequestsCount,
    );

    if (nextLevelScore === user.currentLevelScore) {
      return {
        currentLevelScore: user.currentLevelScore,
        levelChanged: false,
        learningWordsCount: await this.getLearningWordsCount(user.id),
      };
    }

    const updatedUser = await this.usersRepository.updateLevelByTelegramId(
      user.telegramId,
      nextLevelScore,
    );

    return {
      currentLevelScore: updatedUser.currentLevelScore,
      levelChanged: true,
      learningWordsCount: await this.getLearningWordsCount(user.id),
    };
  }

  async updateLevelByTelegramId(
    telegramId: number,
    currentLevelScore: number,
  ): Promise<UserProfile> {
    const user = await this.usersRepository.updateLevelByTelegramId(
      telegramId,
      currentLevelScore,
    );
    const learningWordsCount = await this.getLearningWordsCount(user.id);

    return {
      telegramId: user.telegramId,
      currentLevelScore: user.currentLevelScore,
      learningWordsCount,
    };
  }

  private calculateNextLevelScore(
    currentLevelScore: number,
    generatedWordsCount: number,
    translationRequestsCount: number,
  ): number {
    const difficultyRatio =
      translationRequestsCount / Math.max(generatedWordsCount, 1);

    if (difficultyRatio <= EASY_DIFFICULTY_RATIO) {
      return this.clampLevelScore(currentLevelScore + LEVEL_SCORE_STEP);
    }

    if (difficultyRatio >= HARD_DIFFICULTY_RATIO) {
      return this.clampLevelScore(currentLevelScore - LEVEL_SCORE_STEP);
    }

    return currentLevelScore;
  }

  private clampLevelScore(currentLevelScore: number): number {
    return Math.min(
      MAX_CURRENT_LEVEL_SCORE,
      Math.max(MIN_CURRENT_LEVEL_SCORE, currentLevelScore),
    );
  }

  private containsLemma(text: string, lemma: string): boolean {
    return text.includes(lemma);
  }
}
