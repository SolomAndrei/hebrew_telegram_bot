export const JOB_QUEUE_PORT = Symbol('JOB_QUEUE_PORT');

export type JobType =
  | 'source_raw_text'
  | 'source_url'
  | 'source_telegram_channel';

export type EnqueueTelegramJobInput = {
  type: JobType;
  telegramUserId: number;
  telegramChatId: number;
  telegramUpdateId: number;
  payload: Record<string, unknown>;
};

export type EnqueuedJob = {
  id: string;
};

export type QueuedJob = {
  id: string;
  type: JobType;
  telegramUserId: number;
  telegramChatId: number;
  telegramUpdateId: number;
  payload: Record<string, unknown>;
  attempts: number;
};

export interface JobQueuePort {
  enqueue(input: EnqueueTelegramJobInput): Promise<EnqueuedJob>;
  claimNext(): Promise<QueuedJob | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: string): Promise<void>;
}
