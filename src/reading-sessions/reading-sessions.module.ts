import { Module } from '@nestjs/common';

import { ArticlesModule } from '../articles/articles.module';
import { TelegramAuthModule } from '../telegram-auth/telegram-auth.module';
import { UsersModule } from '../users/users.module';
import { ReadingSessionsController } from './reading-sessions.controller';
import { ReadingSessionsService } from './reading-sessions.service';

@Module({
  imports: [ArticlesModule, TelegramAuthModule, UsersModule],
  controllers: [ReadingSessionsController],
  providers: [ReadingSessionsService],
})
export class ReadingSessionsModule {}
