import Logger from './Logger';

export default class Errorlogger extends Error {
  constructor(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    super(message);
    Logger.error(message);
  }
}
