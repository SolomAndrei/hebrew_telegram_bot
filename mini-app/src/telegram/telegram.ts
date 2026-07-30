type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
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
  close: () => void;
};

export function bootstrapTelegram(): TelegramEnvironment {
  const webApp = window.Telegram?.WebApp;

  if (webApp) {
    webApp.ready();
    webApp.expand();

    return {
      initData: webApp.initData,
      isTelegram: true,
      close: () => webApp.close(),
    };
  }

  return {
    initData: import.meta.env.VITE_TELEGRAM_INIT_DATA_DEV ?? '',
    isTelegram: false,
    close: () => undefined,
  };
}
