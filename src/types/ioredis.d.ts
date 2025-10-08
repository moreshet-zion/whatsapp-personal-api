declare module 'ioredis' {
  export interface RedisOptions {
    lazyConnect?: boolean
    maxRetriesPerRequest?: number | null
  }

  export default class IORedis {
    status: string
    constructor(url: string, options?: RedisOptions)
    connect(): Promise<void>
    ping(): Promise<string>
    set(key: string, value: string, mode: 'EX', seconds: number, condition: 'NX'): Promise<'OK' | null>
    del(key: string): Promise<number>
    xadd(stream: string, ...args: Array<string | number>): Promise<string>
    hset(key: string, data: Record<string, string>): Promise<number>
    exists(key: string): Promise<number>
    get(key: string): Promise<string | null>
    setex(key: string, seconds: number, value: string): Promise<'OK'>
    expire(key: string, seconds: number): Promise<number>
  }
}
