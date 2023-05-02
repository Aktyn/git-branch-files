import type { Disposable } from 'vscode'

export class DisposableInterval implements Disposable {
  private interval: ReturnType<typeof setInterval> | null = null
  private delayTimeout: ReturnType<typeof setTimeout> | null = null
  private isDisposed = false

  /**
   * @param callback function called frequently
   * @param frequency calls frequency in milliseconds
   * */
  constructor(private readonly callback: () => void, private readonly frequency: number) {
    this.interval = setInterval(callback, frequency)
  }

  public get disposed() {
    return this.isDisposed
  }

  public delayNextCall(milliseconds: number) {
    if (this.interval) {
      clearInterval(this.interval)
    }
    this.interval = null

    if (this.delayTimeout) {
      clearTimeout(this.delayTimeout)
    }
    this.delayTimeout = setTimeout(() => {
      this.delayTimeout = null
      this.interval = setInterval(this.callback, this.frequency)
    }, milliseconds)
  }

  public dispose() {
    this.isDisposed = true
    if (this.interval) {
      clearInterval(this.interval)
    }
    if (this.delayTimeout) {
      clearTimeout(this.delayTimeout)
    }
  }
}
