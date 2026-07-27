import { Module } from '@nestjs/common';

import { TelegramAuthModule } from '../telegram-auth/telegram-auth.module';
import { UsersModule } from '../users/users.module';
import { MeController } from './me.controller';

@Module({
  imports: [TelegramAuthModule, UsersModule],
  controllers: [MeController],
})
export class MeModule {}
