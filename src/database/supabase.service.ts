import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

import { Env } from '../config/env.schema';

const websocketTransport = WebSocket as unknown as WebSocketLikeConstructor;

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor(@Inject(ConfigService) configService: ConfigService<Env, true>) {
    this.client = createClient(
      configService.get('SUPABASE_URL', { infer: true }),
      configService.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          transport: websocketTransport,
        },
      },
    );
  }
}
