export function toUserFacingJobError(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();
  const statusCode = getErrorStatusCode(error);

  if (
    message.includes('llm_api_key is required') ||
    message.includes('llm_adaptation_model is required')
  ) {
    return 'LLM is not configured. Check server settings.';
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    message.includes('unauthorized') ||
    message.includes('invalid api key') ||
    message.includes('incorrect api key')
  ) {
    return 'LLM provider rejected the API key. Check server settings.';
  }

  if (
    statusCode === 402 ||
    statusCode === 429 ||
    message.includes('quota') ||
    message.includes('billing') ||
    message.includes('payment') ||
    message.includes('insufficient') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'LLM provider rejected the request, possibly quota or payment limit.';
  }

  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('temporarily unavailable') ||
    message.includes('503') ||
    message.includes('502')
  ) {
    return 'LLM provider is temporarily unavailable. Try again later.';
  }

  if (
    message.includes('column') ||
    message.includes('relation') ||
    message.includes('supabase') ||
    message.includes('postgres') ||
    message.includes('pgrst') ||
    message.includes('database') ||
    message.includes('duplicate key')
  ) {
    return 'Database error while saving the article.';
  }

  if (
    message.includes('extract') ||
    message.includes('could not read') ||
    message.includes('url') ||
    message.includes('channel')
  ) {
    return 'Could not read the source. Try another URL or channel.';
  }

  return 'Unexpected server error while processing your request.';
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return String(error);
}

export function getErrorStatusCode(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  if (typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  if (typeof error.status === 'number') {
    return error.status;
  }

  if (isRecord(error.cause)) {
    return getErrorStatusCode(error.cause);
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
