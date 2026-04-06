export class Semaphore {
  private queue: (() => void)[] = []
  private running = 0

  constructor(private readonly concurrency: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.concurrency) {
      this.running++
      return Promise.resolve()
    }
    return new Promise<void>(resolve => {
      this.queue.push(resolve)
    })
  }

  private release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) {
      this.running++
      next()
    }
  }
}
