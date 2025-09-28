import { createHash } from 'crypto'

export function hash(value: string | Buffer | DataView): string {
  return createHash('sha1').update(value).digest('hex')
}
