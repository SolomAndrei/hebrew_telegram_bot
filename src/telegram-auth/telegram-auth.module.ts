import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { TelegramInitDataGuard } from './telegram-init-data.guard';
import { TelegramInitDataService } from './telegram-init-data.service';

@Module({
  imports: [AccessModule],
  providers: [TelegramInitDataGuard, TelegramInitDataService],
  exports: [TelegramInitDataGuard, TelegramInitDataService],
})
export class TelegramAuthModule {}
