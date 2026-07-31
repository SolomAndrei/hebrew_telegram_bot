export type SkeletonWordToken = {
  type: 'word';
  id: string;
  text: string;
};

export type SkeletonTextToken = {
  type: 'text';
  text: string;
};

export type SkeletonToken = SkeletonWordToken | SkeletonTextToken;

const HEBREW_LETTER_PATTERN = /[\u05D0-\u05EA]/u;
const WORD_INTERNAL_MARK_PATTERN = /[\u05F3\u05F4'"’״׳]/u;

export function tokenizeHebrewText(input: string): SkeletonToken[] {
  const tokens: SkeletonToken[] = [];
  let index = 0;
  let wordId = 0;

  while (index < input.length) {
    const char = input[index];

    if (isHebrewLetter(char)) {
      let end = index + 1;

      while (end < input.length) {
        const next = input[end];

        if (isHebrewLetter(next) || isWordInternalMark(next)) {
          end += 1;
          continue;
        }

        break;
      }

      tokens.push({
        type: 'word',
        id: String(wordId),
        text: input.slice(index, end),
      });
      wordId += 1;
      index = end;
      continue;
    }

    let end = index + 1;

    while (end < input.length && !isHebrewLetter(input[end])) {
      end += 1;
    }

    tokens.push({
      type: 'text',
      text: input.slice(index, end),
    });
    index = end;
  }

  const reconstructed = tokens.map((token) => token.text).join('');

  if (reconstructed !== input) {
    throw new Error('Hebrew tokenizer failed to preserve adapted text');
  }

  return tokens;
}

function isHebrewLetter(char: string): boolean {
  return HEBREW_LETTER_PATTERN.test(char);
}

function isWordInternalMark(char: string): boolean {
  return WORD_INTERNAL_MARK_PATTERN.test(char);
}
