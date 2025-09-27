/**
 * Storage Backend Implementations
 * Provides local file storage and Redis storage with the same interface
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import Redis from 'ioredis';
import { 
  IStorageBackend, 
  IStorageTransaction 
} from '../core/interfaces';
import { Logger } from '../utils/Logger';

/**
 * Local file storage implementation
 * Uses JSON files to mimic Redis-like operations
 */
export class LocalFileStorage implements IStorageBackend {
  private dataDir: string;
  private data: Map<string, any> = new Map();
  private lists: Map<string, any[]> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private hashes: Map<string, Map<string, any>> = new Map();
  private ttls: Map<string, number> = new Map();
  
  constructor(
    dataDir: string = './data/storage',
    private logger: Logger
  ) {
    this.dataDir = dataDir;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Create data directory if it doesn't exist
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Load existing data
    await this.loadData();
    
    // Start TTL cleanup interval
    setInterval(() => this.cleanupExpired(), 60000); // Every minute
  }

  private async loadData(): Promise<void> {
    try {
      const dataFile = path.join(this.dataDir, 'data.json');
      
      if (await this.fileExists(dataFile)) {
        const content = await fs.readFile(dataFile, 'utf-8');
        const parsed = JSON.parse(content);
        
        this.data = new Map(parsed.data || []);
        this.lists = new Map(parsed.lists || []);
        this.sets = new Map((parsed.sets || []).map(([k, v]: [string, string[]]) => [k, new Set(v)]));
        this.hashes = new Map((parsed.hashes || []).map(([k, v]: [string, any]) => [k, new Map(Object.entries(v))]));
        this.ttls = new Map(parsed.ttls || []);
      }
    } catch (error) {
      this.logger.error('Error loading data:', error);
    }
  }

  private async saveData(): Promise<void> {
    try {
      const dataFile = path.join(this.dataDir, 'data.json');
      
      const data = {
        data: Array.from(this.data.entries()),
        lists: Array.from(this.lists.entries()),
        sets: Array.from(this.sets.entries()).map(([k, v]) => [k, Array.from(v)]),
        hashes: Array.from(this.hashes.entries()).map(([k, v]) => [k, Object.fromEntries(v)]),
        ttls: Array.from(this.ttls.entries())
      };
      
      await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Error saving data:', error);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    
    for (const [key, expiry] of this.ttls.entries()) {
      if (expiry <= now) {
        this.data.delete(key);
        this.lists.delete(key);
        this.sets.delete(key);
        this.hashes.delete(key);
        this.ttls.delete(key);
      }
    }
  }

  // Key-value operations
  async get<T = any>(key: string): Promise<T | null> {
    this.cleanupExpired();
    return this.data.get(key) || null;
  }

  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    this.data.set(key, value);
    
    if (ttl) {
      this.ttls.set(key, Date.now() + (ttl * 1000));
    }
    
    await this.saveData();
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
    this.lists.delete(key);
    this.sets.delete(key);
    this.hashes.delete(key);
    this.ttls.delete(key);
    
    await this.saveData();
  }

  async exists(key: string): Promise<boolean> {
    this.cleanupExpired();
    return this.data.has(key) || this.lists.has(key) || this.sets.has(key) || this.hashes.has(key);
  }

  // List operations
  async listPush<T = any>(key: string, value: T): Promise<void> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    
    this.lists.get(key)!.push(value);
    await this.saveData();
  }

  async listRange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    const list = this.lists.get(key) || [];
    
    if (stop === -1) {
      return list.slice(start);
    }
    
    return list.slice(start, stop + 1);
  }

  async listLength(key: string): Promise<number> {
    return (this.lists.get(key) || []).length;
  }

  // Set operations
  async setAdd(key: string, member: string): Promise<void> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    
    this.sets.get(key)!.add(member);
    await this.saveData();
  }

  async setMembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async setRemove(key: string, member: string): Promise<void> {
    this.sets.get(key)?.delete(member);
    await this.saveData();
  }

  // Hash operations
  async hashSet(key: string, field: string, value: any): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    
    this.hashes.get(key)!.set(field, value);
    await this.saveData();
  }

  async hashGet(key: string, field: string): Promise<any> {
    return this.hashes.get(key)?.get(field) || null;
  }

  async hashGetAll(key: string): Promise<Record<string, any>> {
    const hash = this.hashes.get(key);
    return hash ? Object.fromEntries(hash) : {};
  }

  // Pattern operations
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const allKeys = [
      ...this.data.keys(),
      ...this.lists.keys(),
      ...this.sets.keys(),
      ...this.hashes.keys()
    ];
    
    return Array.from(new Set(allKeys)).filter(key => regex.test(key));
  }

  // Transactions
  multi(): IStorageTransaction {
    return new LocalTransaction(this);
  }
}

/**
 * Local transaction implementation
 */
class LocalTransaction implements IStorageTransaction {
  private operations: Array<() => Promise<any>> = [];
  
  constructor(private storage: LocalFileStorage) {}

  get(key: string): IStorageTransaction {
    this.operations.push(() => this.storage.get(key));
    return this;
  }

  set(key: string, value: any, ttl?: number): IStorageTransaction {
    this.operations.push(() => this.storage.set(key, value, ttl));
    return this;
  }

  delete(key: string): IStorageTransaction {
    this.operations.push(() => this.storage.delete(key));
    return this;
  }

  async exec(): Promise<any[]> {
    const results = [];
    
    for (const operation of this.operations) {
      results.push(await operation());
    }
    
    return results;
  }

  discard(): void {
    this.operations = [];
  }
}

/**
 * Redis storage implementation
 */
export class RedisStorage implements IStorageBackend {
  private client: Redis;
  
  constructor(
    config: {
      host?: string;
      port?: number;
      password?: string;
      db?: number;
    } = {},
    private logger: Logger
  ) {
    this.client = new Redis({
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password,
      db: config.db || 0
    });

    this.client.on('connect', () => {
      this.logger.info('Connected to Redis');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis error:', error);
    });
  }

  // Key-value operations
  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    
    if (value === null) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value as any;
    }
  }

  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // List operations
  async listPush<T = any>(key: string, value: T): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.client.rpush(key, serialized);
  }

  async listRange<T = any>(key: string, start: number, stop: number): Promise<T[]> {
    const values = await this.client.lrange(key, start, stop);
    
    return values.map(value => {
      try {
        return JSON.parse(value);
      } catch {
        return value as any;
      }
    });
  }

  async listLength(key: string): Promise<number> {
    return await this.client.llen(key);
  }

  // Set operations
  async setAdd(key: string, member: string): Promise<void> {
    await this.client.sadd(key, member);
  }

  async setMembers(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }

  async setRemove(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  // Hash operations
  async hashSet(key: string, field: string, value: any): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.client.hset(key, field, serialized);
  }

  async hashGet(key: string, field: string): Promise<any> {
    const value = await this.client.hget(key, field);
    
    if (value === null) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async hashGetAll(key: string): Promise<Record<string, any>> {
    const hash = await this.client.hgetall(key);
    const result: Record<string, any> = {};
    
    for (const [field, value] of Object.entries(hash)) {
      try {
        result[field] = JSON.parse(value);
      } catch {
        result[field] = value;
      }
    }
    
    return result;
  }

  // Pattern operations
  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  // Transactions
  multi(): IStorageTransaction {
    return new RedisTransaction(this.client.multi());
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * Redis transaction implementation
 */
class RedisTransaction implements IStorageTransaction {
  constructor(private multi: any) {}

  get(key: string): IStorageTransaction {
    this.multi.get(key);
    return this;
  }

  set(key: string, value: any, ttl?: number): IStorageTransaction {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl) {
      this.multi.setex(key, ttl, serialized);
    } else {
      this.multi.set(key, serialized);
    }
    
    return this;
  }

  delete(key: string): IStorageTransaction {
    this.multi.del(key);
    return this;
  }

  async exec(): Promise<any[]> {
    return await this.multi.exec();
  }

  discard(): void {
    this.multi.discard();
  }
}