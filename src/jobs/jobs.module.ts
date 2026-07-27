import { forwardRef, Module } from '@nestjs/common';

import { AdaptationModule } from '../adaptation/adaptation.module';
import { ArticlesModule } from '../articles/articles.module';
import { BotModule } from '../bot/bot.module';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { SupabaseJobQueueAdapter } from './adapters/supabase-job-queue.adapter';
import { JobsService } from './jobs.service';
import { JobsWorker } from './jobs.worker';
import { JOB_QUEUE_PORT } from './ports/job-queue.port';

@Module({
  imports: [
    AdaptationModule,
    ArticlesModule,
    DatabaseModule,
    forwardRef(() => BotModule),
    UsersModule,
  ],
  providers: [
    JobsService,
    JobsWorker,
    {
      provide: JOB_QUEUE_PORT,
      useClass: SupabaseJobQueueAdapter,
    },
  ],
  exports: [JobsService],
})
export class JobsModule {}
