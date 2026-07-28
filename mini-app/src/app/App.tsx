import { useEffect, useMemo, useState } from 'react';

import type {
  ArticleForReadingResponse,
  MeResponse,
  TranslateWordResponse,
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
      result: TranslateWordResponse;
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

type TextToken = {
  text: string;
  isWord: boolean;
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
}: {
  apiClient: ApiClient;
  article: ArticleForReadingResponse;
  articleId: string;
  me: MeResponse;
}) {
  const [currentLevelScore, setCurrentLevelScore] = useState(
    me.currentLevelScore,
  );
  const [learningWordsCount, setLearningWordsCount] = useState(
    me.learningWordsCount,
  );
  const [translationRequestsCount, setTranslationRequestsCount] = useState(0);
  const [translatedLemmas, setTranslatedLemmas] = useState<string[]>([]);
  const [translation, setTranslation] = useState<TranslationState>({
    status: 'closed',
  });
  const [finishState, setFinishState] = useState<FinishState>({
    status: 'idle',
  });
  const paragraphs = article.adaptedText
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const generatedWordsCount = Math.max(
    paragraphs.reduce(
      (count, paragraph) =>
        count + tokenizeText(paragraph).filter((token) => token.isWord).length,
      0,
    ),
    1,
  );

  async function handleWordClick(word: string, sentenceContext: string) {
    setTranslation({
      status: 'loading',
      word,
    });

    try {
      const result = await apiClient.translateWord({
        articleId,
        word,
        sentenceContext,
      });

      setLearningWordsCount(result.learningWordsCount);
      setTranslationRequestsCount((count) => count + 1);
      setTranslatedLemmas((lemmas) => addUniqueValue(lemmas, result.lemma));
      setTranslation({
        status: 'loaded',
        word,
        result,
      });
    } catch {
      setTranslation({
        status: 'error',
        word,
        message: 'Unable to translate this word.',
      });
    }
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

          <h1
            className="text-right text-3xl font-semibold leading-tight"
            dir="rtl"
          >
            {article.title}
          </h1>
        </header>

        <div
          className="flex flex-col gap-4 text-right text-xl leading-10"
          dir="rtl"
        >
          {paragraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>
              {tokenizeText(paragraph).map((token, tokenIndex) =>
                token.isWord ? (
                  <button
                    key={`${token.text}-${tokenIndex}`}
                    className="rounded px-0.5 underline decoration-slate-300 decoration-dotted underline-offset-4 transition hover:bg-slate-100 active:bg-slate-200"
                    type="button"
                    onClick={() =>
                      void handleWordClick(
                        token.text,
                        getSentenceContext(paragraph, token.text),
                      )
                    }
                  >
                    {token.text}
                  </button>
                ) : (
                  <span key={`${token.text}-${tokenIndex}`}>{token.text}</span>
                ),
              )}
            </p>
          ))}
        </div>

        <footer className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5">
          <button
            className="rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            type="button"
            disabled={finishState.status === 'submitting'}
            onClick={() => void handleFinishReading()}
          >
            {finishState.status === 'submitting'
              ? 'Finishing...'
              : 'Finish reading'}
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
            <TranslationDetail
              label="Context translation"
              value={state.result.contextTranslationRu}
            />
            <TranslationDetail
              label="Transcription"
              value={state.result.transcriptionRu}
            />
            <TranslationDetail label="Lemma" value={state.result.lemma} />
            <TranslationDetail
              label="Part of speech"
              value={state.result.partOfSpeech}
            />
            <TranslationDetail
              label="Base form"
              value={state.result.baseFormReason}
            />
            {state.result.alternatives.length > 0 ? (
              <div>
                <dt className="font-medium text-slate-500">Alternatives</dt>
                <dd className="mt-1 text-slate-900">
                  {state.result.alternatives.join(', ')}
                </dd>
              </div>
            ) : null}
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

function tokenizeText(text: string): TextToken[] {
  return (
    text.match(/[\p{L}\p{M}'’-]+|[^\p{L}\p{M}'’-]+/gu)?.map((token) => ({
      text: token,
      isWord: /\p{L}/u.test(token),
    })) ?? []
  );
}

function getSentenceContext(paragraph: string, word: string): string {
  const wordIndex = paragraph.indexOf(word);

  if (wordIndex === -1) {
    return paragraph;
  }

  const sentenceStart = Math.max(
    paragraph.lastIndexOf('.', wordIndex),
    paragraph.lastIndexOf('!', wordIndex),
    paragraph.lastIndexOf('?', wordIndex),
  );
  const sentenceEndCandidates = ['.', '!', '?']
    .map((marker) => paragraph.indexOf(marker, wordIndex + word.length))
    .filter((index) => index !== -1);
  const sentenceEnd =
    sentenceEndCandidates.length > 0
      ? Math.min(...sentenceEndCandidates)
      : paragraph.length;

  return paragraph.slice(sentenceStart + 1, sentenceEnd + 1).trim();
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
