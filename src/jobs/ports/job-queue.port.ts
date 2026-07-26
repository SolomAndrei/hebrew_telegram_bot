export const JOB_QUEUE_PORT = Symbol('JOB_QUEUE_PORT');

export type JobType = 'telegram_message';

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

export interface JobQueuePort {
  enqueue(input: EnqueueTelegramJobInput): Promise<EnqueuedJob>;
}
