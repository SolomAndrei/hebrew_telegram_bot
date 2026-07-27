export type SubmittedSource =
  | {
      type: 'raw_hebrew_text';
      text: string;
    }
  | {
      type: 'url';
      url: string;
    }
  | {
      type: 'telegram_channel';
      channelRef: string;
    }
  | {
      type: 'unsupported';
      reason: 'empty' | 'non_hebrew_text' | 'unsupported_message';
    };
