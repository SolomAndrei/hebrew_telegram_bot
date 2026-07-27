export const TELEGRAM_CHANNEL_EXTRACTOR_PORT = Symbol(
  'TELEGRAM_CHANNEL_EXTRACTOR_PORT',
);

export type TelegramChannelPost = {
  id: string;
  text: string;
  publishedAt?: string;
};

export interface TelegramChannelExtractorPort {
  getLatestPosts(
    channelRef: string,
    limit: number,
  ): Promise<TelegramChannelPost[]>;
}
