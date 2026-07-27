import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AccessModule } from './access/access.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BotModule } from './bot/bot.module';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';
import { MeModule } from './me/me.module';
import { TranslationModule } from './translation/translation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    AccessModule,
    BotModule,
    DatabaseModule,
    JobsModule,
    MeModule,
    ScheduleModule.forRoot(),
    TranslationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
