import Logger from './Logger';

/**
 * Custom Error class that automatically logs errors via Logger.
 */
export default class Errorlogger extends Error {
  constructor(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    super(message);
    Logger.error(message);
  }
}
