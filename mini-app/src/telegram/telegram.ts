type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export type TelegramEnvironment = {
  initData: string;
  isTelegram: boolean;
};

export function bootstrapTelegram(): TelegramEnvironment {
  const webApp = window.Telegram?.WebApp;

  if (webApp) {
    webApp.ready();
    webApp.expand();

    return {
      initData: webApp.initData,
      isTelegram: true,
    };
  }

  return {
    initData: import.meta.env.VITE_TELEGRAM_INIT_DATA_DEV ?? '',
    isTelegram: false,
  };
}
