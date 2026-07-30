const HEBREW_MARKS_PATTERN = /[\u0591-\u05C7]/gu;
const HEBREW_MARK_PATTERN = /[\u0591-\u05C7]/u;
const HEBREW_LETTER_PATTERN = /[\u05D0-\u05EA]/u;

const SHEVA = '\u05B0';
const HATAF_SEGOL = '\u05B1';
const HATAF_PATAH = '\u05B2';
const HATAF_QAMATS = '\u05B3';
const HIRIQ = '\u05B4';
const TSERE = '\u05B5';
const SEGOL = '\u05B6';
const PATAH = '\u05B7';
const QAMATS = '\u05B8';
const HOLAM = '\u05B9';
const HOLAM_HASER = '\u05BA';
const QUBUTS = '\u05BB';
const DAGESH = '\u05BC';
const SHIN_DOT = '\u05C1';
const SIN_DOT = '\u05C2';

type HebrewLetterGroup = {
  letter: string;
  marks: Set<string>;
};

export function stripHebrewMarks(input: string): string {
  return input.normalize('NFC').replace(HEBREW_MARKS_PATTERN, '');
}

export function transcribeHebrewToRussian(input: {
  text: string;
  pointedText: string;
}): string {
  const unpointedText = stripHebrewMarks(input.pointedText);

  if (unpointedText !== input.text) {
    throw new Error(
      `Pointed Hebrew token does not match source token: ${input.pointedText}`,
    );
  }

  return groupHebrewLetters(input.pointedText)
    .map((group, index, groups) =>
      transcribeGroup(group, index, groups.length),
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupHebrewLetters(input: string): HebrewLetterGroup[] {
  const groups: HebrewLetterGroup[] = [];

  for (const char of input.normalize('NFC')) {
    if (HEBREW_LETTER_PATTERN.test(char)) {
      groups.push({
        letter: char,
        marks: new Set(),
      });
      continue;
    }

    if (HEBREW_MARK_PATTERN.test(char) && groups.length > 0) {
      groups[groups.length - 1].marks.add(char);
    }
  }

  return groups;
}

function transcribeGroup(
  group: HebrewLetterGroup,
  index: number,
  groupsLength: number,
): string {
  return [
    transcribeConsonant(group, index === groupsLength - 1),
    transcribeVowel(group),
  ].join('');
}

function transcribeConsonant(
  group: HebrewLetterGroup,
  isLastGroup: boolean,
): string {
  const hasDagesh = group.marks.has(DAGESH);

  switch (group.letter) {
    case 'א':
    case 'ע':
      return '';
    case 'ב':
      return hasDagesh ? 'б' : 'в';
    case 'ג':
      return 'г';
    case 'ד':
      return 'д';
    case 'ה':
      return isLastGroup && !hasDagesh ? '' : 'х';
    case 'ו':
      return isVavVowel(group) ? '' : 'в';
    case 'ז':
      return 'з';
    case 'ח':
      return 'х';
    case 'ט':
      return 'т';
    case 'י':
      return 'й';
    case 'כ':
    case 'ך':
      return hasDagesh ? 'к' : 'х';
    case 'ל':
      return 'л';
    case 'מ':
    case 'ם':
      return 'м';
    case 'נ':
    case 'ן':
      return 'н';
    case 'ס':
      return 'с';
    case 'פ':
    case 'ף':
      return hasDagesh ? 'п' : 'ф';
    case 'צ':
    case 'ץ':
      return 'ц';
    case 'ק':
      return 'к';
    case 'ר':
      return 'р';
    case 'ש':
      return group.marks.has(SIN_DOT) && !group.marks.has(SHIN_DOT)
        ? 'с'
        : 'ш';
    case 'ת':
      return 'т';
    default:
      return '';
  }
}

function transcribeVowel(group: HebrewLetterGroup): string {
  if (group.letter === 'ו' && isVavVowel(group)) {
    if (group.marks.has(DAGESH) || group.marks.has(QUBUTS)) {
      return 'у';
    }

    return 'о';
  }

  if (group.marks.has(HIRIQ)) {
    return 'и';
  }

  if (group.marks.has(TSERE) || group.marks.has(SEGOL)) {
    return 'е';
  }

  if (
    group.marks.has(PATAH) ||
    group.marks.has(QAMATS) ||
    group.marks.has(HATAF_PATAH)
  ) {
    return 'а';
  }

  if (group.marks.has(HOLAM) || group.marks.has(HOLAM_HASER)) {
    return 'о';
  }

  if (group.marks.has(QUBUTS)) {
    return 'у';
  }

  if (group.marks.has(HATAF_SEGOL)) {
    return 'е';
  }

  if (group.marks.has(HATAF_QAMATS)) {
    return 'о';
  }

  if (group.marks.has(SHEVA)) {
    return '';
  }

  return '';
}

function isVavVowel(group: HebrewLetterGroup): boolean {
  return (
    group.letter === 'ו' &&
    (group.marks.has(DAGESH) ||
      group.marks.has(QUBUTS) ||
      group.marks.has(HOLAM) ||
      group.marks.has(HOLAM_HASER))
  );
}
