type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR';

/**
 * Centralized logger with timestamps for production use.
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
}