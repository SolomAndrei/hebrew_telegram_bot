import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Env } from '../config/env.schema';

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

@Injectable()
export class RateLimitService {
  private readonly perUserEvents = new Map<number, number[]>();
  private globalEvents: number[] = [];

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<Env, true>,
  ) {}

  checkTelegramUser(telegramId: number): RateLimitResult {
    const now = Date.now();
    const windowMs = 60_000;
    const userLimit = this.configService.get('TELEGRAM_USER_RATE_LIMIT_PER_MINUTE', {
      infer: true,
    });
    const globalLimit = this.configService.get(
      'TELEGRAM_GLOBAL_RATE_LIMIT_PER_MINUTE',
      { infer: true },
    );

    this.globalEvents = this.prune(this.globalEvents, now, windowMs);

    if (this.globalEvents.length >= globalLimit) {
      return this.createRetryResult(this.globalEvents, now, windowMs);
    }

    const userEvents = this.prune(
      this.perUserEvents.get(telegramId) ?? [],
      now,
      windowMs,
    );

    if (userEvents.length >= userLimit) {
      this.perUserEvents.set(telegramId, userEvents);
      return this.createRetryResult(userEvents, now, windowMs);
    }

    userEvents.push(now);
    this.globalEvents.push(now);
    this.perUserEvents.set(telegramId, userEvents);

    return { allowed: true };
  }

  private prune(events: number[], now: number, windowMs: number): number[] {
    return events.filter((eventTime) => now - eventTime < windowMs);
  }

  private createRetryResult(
    events: number[],
    now: number,
    windowMs: number,
  ): RateLimitResult {
    const oldestEvent = events[0] ?? now;

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((windowMs - (now - oldestEvent)) / 1000),
      ),
    };
  }
}
