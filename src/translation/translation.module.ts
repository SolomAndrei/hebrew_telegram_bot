import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { TelegramAuthModule } from '../telegram-auth/telegram-auth.module';
import { UsersModule } from '../users/users.module';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';

@Module({
  imports: [AiModule, ArticlesModule, TelegramAuthModule, UsersModule],
  controllers: [TranslationController],
  providers: [TranslationService],
})
export class TranslationModule {}
