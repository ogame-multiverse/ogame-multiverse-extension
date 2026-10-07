import { RunContextType } from "../runContextType";
import { Logger } from "./logger";

class LoggerFactory {
  private readonly loggers: Map<string, Logger> = new Map<string, Logger>();

  constructor(private readonly runContext: RunContextType) { }

  public CreateLogger(name: string | undefined = undefined): Logger {
    const key = name ?? "default";
    let logger = this.loggers.get(key);
    if (!logger) {
      logger = new Logger(this.runContext, key);
      this.loggers.set(key, logger);
    }
    return logger;
  }
}


export const contentScriptLoggerFactory = new LoggerFactory(RunContextType.ContentScript);
export const serviceWorkerLoggerFactory = new LoggerFactory(RunContextType.ServiceWorker);
export const sidePanelLoggerFactory = new LoggerFactory(RunContextType.SidePanel);