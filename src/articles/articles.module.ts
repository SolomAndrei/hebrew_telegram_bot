import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { TelegramAuthModule } from '../telegram-auth/telegram-auth.module';
import { UsersModule } from '../users/users.module';
import { SupabaseArticlesRepositoryAdapter } from './adapters/supabase-articles-repository.adapter';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ARTICLES_REPOSITORY_PORT } from './ports/articles-repository.port';

@Module({
  imports: [DatabaseModule, TelegramAuthModule, UsersModule],
  controllers: [ArticlesController],
  providers: [
    ArticlesService,
    {
      provide: ARTICLES_REPOSITORY_PORT,
      useClass: SupabaseArticlesRepositoryAdapter,
    },
  ],
  exports: [ArticlesService],
})
export class ArticlesModule {}
