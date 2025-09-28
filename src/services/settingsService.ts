import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import pino from 'pino';
import { RecorderSettings } from './sentMessageRecorder.js';

const base44SettingsSchema = z.object({
  url: z.string().url(),
  apiKey: z.string().min(1)
});

const settingsSchema = z.object({
  history_backend: z.enum(['redis', 'base44']).default('redis'),
  base44: base44SettingsSchema.optional()
}).refine((data) => {
  if (data.history_backend === 'base44') {
    return data.base44 && data.base44.url && data.base44.apiKey;
  }
  return true;
}, {
  message: "Base44 backend requires 'base44' configuration with 'url' and 'apiKey'"
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
      history_backend: 'redis'
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
    const settings: RecorderSettings = {
      history_backend: this.settings.history_backend
    };
    
    if (this.settings.base44) {
      settings.base44 = this.settings.base44;
    }
    
    return settings;
  }
}