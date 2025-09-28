export type MessageType = 'text'|'image'|'audio'|'video'|'document'|'sticker'|'unknown';

export interface InboundMessage {
  id: string;
  ts: number;
  from: string;
  to: string;
  chatId: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  dedupeKey: string;
  conversationKey: string;
  metadata?: Record<string, string|number|boolean>;
}

export interface OutboundCommand {
  correlationId?: string;
  to: string;
  chatId?: string;
  text?: string;
  media?: {
    kind: MessageType;
    url: string;
    fileName?: string;
  };
  notBefore?: number;
  rateLimitGroup?: string;
  dedupeKey?: string;
}

export interface SentRecord {
  id: string;
  ts: number;
  to: string;
  chatId?: string;
  via: 'text'|'image'|'audio'|'video'|'document'|'sticker';
  bodyPreview?: string;
  correlationId?: string;
  waMessageId?: string;
  dedupeKey?: string;
}