import { Module } from '@nestjs/common';

import { HebrewTextValidatorService } from './hebrew-text-validator.service';
import { SourceClassifierService } from './source-classifier.service';

@Module({
  providers: [HebrewTextValidatorService, SourceClassifierService],
  exports: [HebrewTextValidatorService, SourceClassifierService],
})
export class SourcesModule {}
