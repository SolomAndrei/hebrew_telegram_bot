import { forwardRef, Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { JobsModule } from '../jobs/jobs.module';
import { SourcesModule } from '../sources/sources.module';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';

@Module({
  imports: [AccessModule, forwardRef(() => JobsModule), SourcesModule],
  controllers: [BotController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
