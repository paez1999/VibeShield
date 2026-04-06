import { describe, it, expect } from 'vitest'
import { Semaphore } from '@/shared/semaphore'

describe('Semaphore', () => {
  it('allows up to N concurrent tasks', async () => {
    const sem = new Semaphore(2)
    let running = 0
    let maxRunning = 0
    const task = async () => {
      return sem.run(async () => {
        running++
        maxRunning = Math.max(maxRunning, running)
        await new Promise(r => setTimeout(r, 50))
        running--
        return 'done'
      })
    }
    const results = await Promise.all([task(), task(), task(), task()])
    expect(maxRunning).toBeLessThanOrEqual(2)
    expect(results).toEqual(['done', 'done', 'done', 'done'])
  })

  it('propagates errors from tasks', async () => {
    const sem = new Semaphore(2)
    await expect(sem.run(async () => { throw new Error('boom') })).rejects.toThrow('boom')
  })

  it('releases slot on error so other tasks can proceed', async () => {
    const sem = new Semaphore(1)
    try { await sem.run(async () => { throw new Error('fail') }) } catch {}
    const result = await sem.run(async () => 'recovered')
    expect(result).toBe('recovered')
  })
})
