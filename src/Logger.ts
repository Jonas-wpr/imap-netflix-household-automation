type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR';

/**
 * Central logger that prefixes messages with timestamps and levels.
 */
export default class Logger {
  private static formatDate(): string {
    return new Intl.DateTimeFormat('default', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date());
  }

  private static log(level: LogLevel, message: string): void {
    console.log(`[${this.formatDate()}] [${level}] ${message}`);
  }

  static info(message: string): void {
    this.log('INFO', message);
  }

  static success(message: string): void {
    this.log('SUCCESS', message);
  }

  static error(message: string | Error): void {
    const msg = message instanceof Error ? message.message : message;
    this.log('ERROR', msg);
  }

  /**
   * Log the provided value and return an Error suitable for throwing.
   */
  static createError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    this.error(message);
    return new Error(message);
  }
}