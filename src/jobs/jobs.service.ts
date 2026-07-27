import { Inject, Injectable } from '@nestjs/common';

import {
  EnqueueTelegramJobInput,
  EnqueuedJob,
  JOB_QUEUE_PORT,
  JobQueuePort,
  QueuedJob,
} from './ports/job-queue.port';

@Injectable()
export class JobsService {
  constructor(
    @Inject(JOB_QUEUE_PORT) private readonly jobQueue: JobQueuePort,
  ) {}

  enqueueTelegramJob(input: EnqueueTelegramJobInput): Promise<EnqueuedJob> {
    return this.jobQueue.enqueue(input);
  }

  claimNext(): Promise<QueuedJob | null> {
    return this.jobQueue.claimNext();
  }

  complete(jobId: string): Promise<void> {
    return this.jobQueue.complete(jobId);
  }

  fail(jobId: string, error: string): Promise<void> {
    return this.jobQueue.fail(jobId, error);
  }
}
