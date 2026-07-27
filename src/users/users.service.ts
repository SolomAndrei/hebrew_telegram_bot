import { Inject, Injectable } from '@nestjs/common';

import {
  LearningWord,
  UpsertLearningWordInput,
  User,
  USERS_REPOSITORY_PORT,
  UsersRepositoryPort,
} from './ports/users-repository.port';

export const MIN_CURRENT_LEVEL_SCORE = 100;
export const MAX_CURRENT_LEVEL_SCORE = 1000;

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
}
