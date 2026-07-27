import { Injectable } from '@nestjs/common';

@Injectable()
export class HebrewTextValidatorService {
  isProbablyHebrew(text: string): boolean {
    const letters = [...text].filter((char) => /\p{L}/u.test(char));

    if (letters.length < 3) {
      return false;
    }

    const hebrewLetters = letters.filter((char) => /[\u0590-\u05FF]/u.test(char));

    return hebrewLetters.length / letters.length >= 0.3;
  }
}
