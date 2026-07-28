import { forwardRef, Module } from '@nestjs/common';

import { AdaptationModule } from '../adaptation/adaptation.module';
import { ArticlesModule } from '../articles/articles.module';
import { BotModule } from '../bot/bot.module';
import { DatabaseModule } from '../database/database.module';
import { SourcesModule } from '../sources/sources.module';
import { UsersModule } from '../users/users.module';
import { SupabaseJobQueueAdapter } from './adapters/supabase-job-queue.adapter';
import { JobsService } from './jobs.service';
import { JobsWorker } from './jobs.worker';
import { JOB_QUEUE_PORT } from './ports/job-queue.port';
import { RssNewsCronService } from './rss-news-cron.service';

@Module({
  imports: [
    AdaptationModule,
    ArticlesModule,
    DatabaseModule,
    forwardRef(() => BotModule),
    SourcesModule,
    UsersModule,
  ],
  providers: [
    JobsService,
    JobsWorker,
    RssNewsCronService,
    {
      provide: JOB_QUEUE_PORT,
      useClass: SupabaseJobQueueAdapter,
    },
  ],
  exports: [JobsService],
})
export class JobsModule {}
