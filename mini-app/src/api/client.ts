import type {
  ArticleForReadingResponse,
  MeResponse,
  TranslateWordRequest,
  TranslateWordResponse,
} from '../../../src/mini-app/mini-app-api.contracts';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type ApiClient = {
  getMe: () => Promise<MeResponse>;
  getArticle: (articleId: string) => Promise<ArticleForReadingResponse>;
  translateWord: (
    request: TranslateWordRequest,
  ) => Promise<TranslateWordResponse>;
};

export function createApiClient(initData: string): ApiClient {
  return {
    getMe: () => requestJson<MeResponse>('/me', initData),
    getArticle: (articleId) =>
      requestJson<ArticleForReadingResponse>(
        `/articles/${encodeURIComponent(articleId)}`,
        initData,
      ),
    translateWord: (request) =>
      requestJson<TranslateWordResponse>('/translate-word', initData, {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  };
}

async function requestJson<Response>(
  path: string,
  initData: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-telegram-init-data': initData,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError('Request failed', response.status);
  }

  return (await response.json()) as Response;
}
