import { Inject, Injectable } from '@nestjs/common';

import {
  EnqueueTelegramJobInput,
  EnqueuedJob,
  JOB_QUEUE_PORT,
  JobQueuePort,
} from './ports/job-queue.port';

@Injectable()
export class JobsService {
  constructor(
    @Inject(JOB_QUEUE_PORT) private readonly jobQueue: JobQueuePort,
  ) {}

  enqueueTelegramJob(input: EnqueueTelegramJobInput): Promise<EnqueuedJob> {
    return this.jobQueue.enqueue(input);
  }
}
