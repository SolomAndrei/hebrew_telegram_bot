import { useEffect, useMemo, useState } from 'react';

import type {
  ArticleForReadingResponse,
  ArticleToken,
  MeResponse,
  WordArticleToken,
} from '../../../src/mini-app/mini-app-api.contracts';
import type { ApiClient } from '../api/client';
import { ApiError } from '../api/client';
import type { TelegramEnvironment } from '../telegram/telegram';

type AppProps = {
  apiClient: ApiClient;
  telegram: TelegramEnvironment;
};

type LoadState =
  | {
      status: 'idle' | 'loading';
    }
  | {
      status: 'loaded';
      me: MeResponse;
      article: ArticleForReadingResponse;
    }
  | {
      status: 'error';
      message: string;
    };

type TranslationState =
  | {
      status: 'closed';
    }
  | {
      status: 'loading';
      word: string;
    }
  | {
      status: 'loaded';
      word: string;
      result: WordArticleToken;
    }
  | {
      status: 'error';
      word: string;
      message: string;
    };

type FinishState =
  | {
      status: 'idle';
    }
  | {
      status: 'submitting';
    }
  | {
      status: 'completed';
      levelChanged: boolean;
    }
  | {
      status: 'error';
      message: string;
    };

export function App({ apiClient, telegram }: AppProps) {
  const articleId = useMemo(() => getArticleIdFromPath(), []);
  const [state, setState] = useState<LoadState>({ status: 'idle' });

  useEffect(() => {
    if (!articleId) {
      setState({
        status: 'error',
        message: 'Open an article link from Telegram.',
      });
      return;
    }

    const currentArticleId = articleId;
    let isCurrent = true;

    async function loadArticle() {
      setState({ status: 'loading' });

      try {
        const [me, article] = await Promise.all([
          apiClient.getMe(),
          apiClient.getArticle(currentArticleId),
        ]);

        if (isCurrent) {
          setState({
            status: 'loaded',
            me,
            article,
          });
        }
      } catch (error) {
        if (isCurrent) {
          setState({
            status: 'error',
            message: getLoadErrorMessage(error),
          });
        }
      }
    }

    void loadArticle();

    return () => {
      isCurrent = false;
    };
  }, [apiClient, articleId]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {!telegram.isTelegram ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Local preview mode. Protected API calls need dev init data.
          </div>
        ) : null}

        {state.status === 'idle' || state.status === 'loading' ? (
          <StatusCard message="Loading article..." />
        ) : null}

        {state.status === 'error' ? <StatusCard message={state.message} /> : null}

        {state.status === 'loaded' ? (
          <ReadingScreen
            apiClient={apiClient}
            article={state.article}
            articleId={state.article.id}
            me={state.me}
            telegram={telegram}
          />
        ) : null}
      </div>
    </main>
  );
}

function ReadingScreen({
  apiClient,
  article,
  articleId,
  me,
  telegram,
}: {
  apiClient: ApiClient;
  article: ArticleForReadingResponse;
  articleId: string;
  me: MeResponse;
  telegram: TelegramEnvironment;
}) {
  const [currentLevelScore, setCurrentLevelScore] = useState(
    me.currentLevelScore,
  );
  const [learningWordsCount, setLearningWordsCount] = useState(
    me.learningWordsCount,
  );
  const [translationRequestsCount, setTranslationRequestsCount] = useState(0);
  const [translatedLemmas, setTranslatedLemmas] = useState<string[]>([]);
  const [showNiqqud, setShowNiqqud] = useState(false);
  const [translation, setTranslation] = useState<TranslationState>({
    status: 'closed',
  });
  const [finishState, setFinishState] = useState<FinishState>({
    status: 'idle',
  });
  const generatedWordsCount = Math.max(countWordTokens(article.tokens), 1);

  function handleWordClick(token: WordArticleToken) {
    setTranslationRequestsCount((count) => count + 1);
    setTranslatedLemmas((lemmas) => addUniqueValue(lemmas, token.lemma));
    setTranslation({
      status: 'loaded',
      word: token.text,
      result: token,
    });
  }

  async function handleFinishReading() {
    setFinishState({ status: 'submitting' });

    try {
      const result = await apiClient.finishReadingSession({
        articleId,
        generatedWordsCount,
        translationRequestsCount,
        translatedLemmas,
      });

      setCurrentLevelScore(result.currentLevelScore);
      setLearningWordsCount(result.learningWordsCount);

      if (telegram.isTelegram) {
        telegram.close();
        return;
      }

      setFinishState({
        status: 'completed',
        levelChanged: result.levelChanged,
      });
    } catch {
      setFinishState({
        status: 'error',
        message: 'Unable to finish reading.',
      });
    }
  }

  return (
    <>
      <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <header className="mb-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Article level {article.difficultyScore}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Your level {currentLevelScore}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Learning words {learningWordsCount}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Translation requests {translationRequestsCount}
            </span>
          </div>

          <label className="flex items-center justify-end gap-2 text-sm font-medium text-slate-700">
            <span>Show niqqud</span>
            <input
              checked={showNiqqud}
              type="checkbox"
              onChange={(event) => setShowNiqqud(event.currentTarget.checked)}
            />
          </label>
        </header>

        <div
          className="whitespace-pre-wrap text-right text-xl leading-10"
          dir="rtl"
        >
          {article.tokens.map((token, tokenIndex) =>
            token.type === 'word' ? (
              <button
                key={token.id}
                className="rounded px-0.5 underline decoration-slate-300 decoration-dotted underline-offset-4 transition hover:bg-slate-100 active:bg-slate-200"
                type="button"
                onClick={() => handleWordClick(token)}
              >
                {showNiqqud ? token.pointedText : token.text}
              </button>
            ) : (
              <span key={`text-${tokenIndex}`}>{token.text}</span>
            ),
          )}
        </div>

        <footer className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            type="button"
            disabled={finishState.status === 'submitting'}
            onClick={() => void handleFinishReading()}
          >
            {finishState.status === 'submitting' ? (
              <>
                <Spinner />
                <span>Finishing...</span>
              </>
            ) : (
              'Finish reading'
            )}
          </button>
          <FinishReadingStatus state={finishState} />
        </footer>
      </article>

      <TranslationSheet
        state={translation}
        onClose={() => setTranslation({ status: 'closed' })}
      />
    </>
  );
}

function StatusCard({ message }: { message: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 text-center text-slate-700 shadow-sm ring-1 ring-slate-200">
      {message}
    </div>
  );
}

function TranslationSheet({
  state,
  onClose,
}: {
  state: TranslationState;
  onClose: () => void;
}) {
  if (state.status === 'closed') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 px-3 pb-3">
      <section className="mx-auto w-full max-w-2xl rounded-t-3xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Translation</h2>
          <button
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mb-4 rounded-2xl bg-slate-50 p-3 text-right text-2xl" dir="rtl">
          {state.word}
        </div>

        {state.status === 'loading' ? (
          <p className="text-slate-600">Translating...</p>
        ) : null}

        {state.status === 'error' ? (
          <p className="text-red-700">{state.message}</p>
        ) : null}

        {state.status === 'loaded' ? (
          <dl className="flex flex-col gap-3 text-sm">
            <TranslationDetail label="Translation" value={state.result.translationRu} />
            <TranslationDetail
              label="Transcription"
              value={state.result.transcriptionRu}
            />
            <TranslationDetail
              label="With niqqud"
              value={state.result.pointedText}
            />
            <TranslationDetail label="Lemma" value={state.result.lemma} />
          </dl>
        ) : null}
      </section>
    </div>
  );
}

function FinishReadingStatus({ state }: { state: FinishState }) {
  if (state.status === 'idle' || state.status === 'submitting') {
    return null;
  }

  if (state.status === 'error') {
    return <p className="text-sm text-red-700">{state.message}</p>;
  }

  return (
    <p className="text-sm text-slate-600">
      Reading session saved.
      {state.levelChanged ? ' Your level was updated.' : ''}
    </p>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

function TranslationDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{value}</dd>
    </div>
  );
}

function countWordTokens(tokens: ArticleToken[]): number {
  return tokens.filter((token) => token.type === 'word').length;
}

function addUniqueValue(values: string[], nextValue: string): string[] {
  if (values.includes(nextValue)) {
    return values;
  }

  return [...values, nextValue];
}

function getArticleIdFromPath(): string | undefined {
  const [, resource, articleId] = window.location.pathname.split('/');

  if (resource !== 'articles' || !articleId) {
    return undefined;
  }

  return articleId;
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Telegram authorization failed.';
  }

  if (error instanceof ApiError && error.status === 404) {
    return 'Article was not found.';
  }

  return 'Unable to load article.';
}
