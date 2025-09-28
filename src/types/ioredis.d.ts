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
  }
}
