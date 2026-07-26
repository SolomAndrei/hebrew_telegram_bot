import { Module } from '@nestjs/common';

import { RateLimitService } from './rate-limit.service';
import { TelegramAccessService } from './telegram-access.service';

@Module({
  providers: [RateLimitService, TelegramAccessService],
  exports: [RateLimitService, TelegramAccessService],
})
export class AccessModule {}
