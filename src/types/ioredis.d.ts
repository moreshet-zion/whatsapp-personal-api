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
    exists(key: string): Promise<number>
    setex(key: string, seconds: number, value: string): Promise<'OK'>
    xadd(key: string, ...args: any[]): Promise<string>
    xrevrange(key: string, end: string, start: string, ...args: any[]): Promise<Array<[string, string[]]>>
  }
}
