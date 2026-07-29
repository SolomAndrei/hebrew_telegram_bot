import { z } from 'zod';

export function parseLlmJsonResponse<T>(
  text: string,
  schema: z.ZodType<T>,
  context: string,
): T {
  const parsed = JSON.parse(extractJsonObject(text));
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `${context} response did not match schema: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}
