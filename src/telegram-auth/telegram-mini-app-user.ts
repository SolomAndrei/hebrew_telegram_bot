export type TelegramMiniAppUser = {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  allowsWriteToPm?: boolean;
};

export type RequestWithTelegramMiniAppUser = {
  headers: Record<string, string | string[] | undefined>;
  telegramMiniAppUser?: TelegramMiniAppUser;
};
