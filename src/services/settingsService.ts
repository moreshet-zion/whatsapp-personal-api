import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import pino from 'pino';
import { RecorderSettings } from './sentMessageRecorder.js';

const settingsSchema = z.object({
  history_backend: z.enum(['redis', 'base44']).default('redis'),
  agent: z.object({
    enabled: z.boolean().default(false),
    openaiApiKey: z.string().optional(),
    model: z.string().default('gpt-4o-mini'),
    persona: z.string().default('You are a helpful AI assistant responding to WhatsApp messages. Be friendly, concise, and helpful.'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(4096).default(500),
    autoReply: z.boolean().default(true),
    whitelistedNumbers: z.array(z.string()).default([]),
    conversationContextLimit: z.number().min(1).max(50).default(10)
  }).default({
    enabled: false,
    model: 'gpt-4o-mini',
    persona: 'You are a helpful AI assistant responding to WhatsApp messages. Be friendly, concise, and helpful.',
    temperature: 0.7,
    maxTokens: 500,
    autoReply: true,
    whitelistedNumbers: [],
    conversationContextLimit: 10
  })
});

export type AppSettings = z.infer<typeof settingsSchema>;

export class SettingsService {
  private readonly logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private readonly settingsFile: string;
  private settings: AppSettings;

  constructor(dataDir = path.resolve(process.cwd(), 'data')) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.settingsFile = path.join(dataDir, 'settings.json');
    this.settings = this.loadSettings();
  }

  private loadSettings(): AppSettings {
    try {
      if (fs.existsSync(this.settingsFile)) {
        const raw = fs.readFileSync(this.settingsFile, 'utf8');
        const parsed = JSON.parse(raw);
        return settingsSchema.parse(parsed);
      }
    } catch (err) {
      this.logger.warn({ err }, 'Failed to load settings, using defaults');
    }
    
    // Default settings
    const defaultSettings: AppSettings = {
      history_backend: 'redis',
      agent: {
        enabled: false,
        model: 'gpt-4o-mini',
        persona: 'You are a helpful AI assistant responding to WhatsApp messages. Be friendly, concise, and helpful.',
        temperature: 0.7,
        maxTokens: 500,
        autoReply: true,
        whitelistedNumbers: [],
        conversationContextLimit: 10
      }
    };
    
    this.saveSettings(defaultSettings);
    return defaultSettings;
  }

  private saveSettings(settings: AppSettings): void {
    try {
      fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
    } catch (err) {
      this.logger.error({ err }, 'Failed to save settings');
    }
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    const newSettings = { ...this.settings, ...updates };
    
    // Validate the new settings
    const validated = settingsSchema.parse(newSettings);
    
    this.settings = validated;
    this.saveSettings(this.settings);
    
    this.logger.info({ settings: this.settings }, 'Settings updated');
    return { ...this.settings };
  }

  public getRecorderSettings(): RecorderSettings {
    return {
      history_backend: this.settings.history_backend
    };
  }
}