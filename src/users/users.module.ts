import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { SupabaseUsersRepositoryAdapter } from './adapters/supabase-users-repository.adapter';
import { USERS_REPOSITORY_PORT } from './ports/users-repository.port';
import { UsersService } from './users.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    UsersService,
    {
      provide: USERS_REPOSITORY_PORT,
      useClass: SupabaseUsersRepositoryAdapter,
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
