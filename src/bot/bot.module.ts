import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { JobsModule } from '../jobs/jobs.module';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';

@Module({
  imports: [AccessModule, JobsModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
