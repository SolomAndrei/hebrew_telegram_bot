import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { SupabaseJobQueueAdapter } from './adapters/supabase-job-queue.adapter';
import { JobsService } from './jobs.service';
import { JOB_QUEUE_PORT } from './ports/job-queue.port';

@Module({
  imports: [DatabaseModule],
  providers: [
    JobsService,
    {
      provide: JOB_QUEUE_PORT,
      useClass: SupabaseJobQueueAdapter,
    },
  ],
  exports: [JobsService],
})
export class JobsModule {}
