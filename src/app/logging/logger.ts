import { GlobalConstants } from "../globalConstants";
import { RunContextType } from "../runContextType";

// --- Styles for console.log ---
/*
const APP_VERSION_STYLE = [
  "font-size:1em",
  "background-color:#195ee6",
  "color:#b9f4ff",
  "font-family:monospace",
  "border-radius:0.5em",
  "padding:0 0.25em",
].join(";");
const LOG_NAME_STYLE = [
  "font-size:1em",
  "background-color:#70ce37",
  "color:#16531e",
  "font-family:monospace",
  "border-radius:0.5em",
  "padding:0 0.25em",
].join(";");
const LOG_DATE_STYLE = [
  "font-size:1em",
  "background-color:#3C3C3C",
  "color:#D1D1D1",
  "font-family:monospace",
  "border-radius:0.5em",
  "padding:0 0.25em",
].join(";");
*/
const APP_VERSION_STYLE = [
  "font-size: 0.85em",
  "background-color: #1e3a5f",
  "color: #7aa2f7",
  "border: 1px solid #2ac3de44",
  "font-family: monospace",
  "border-radius: 4px",
  "padding: 2px 6px",
  "font-weight: 600",
].join(";");

const LOG_NAME_STYLE = [
  "font-size: 0.85em",
  "background-color: #1f3526",
  "color: #73daca",
  "border: 1px solid #73daca44",
  "font-family: monospace",
  "border-radius: 4px",
  "padding: 2px 6px",
  "font-weight: 600",
].join(";");

const LOG_DATE_STYLE = [
  "font-size: 0.85em",
  "background-color: #24283b",
  "color: #565f89",
  "font-family: monospace",
  "border-radius: 4px",
  "padding: 2px 6px",
].join(";");
const CONTEXT_ICONS: Record<RunContextType, string> = {
  [RunContextType.Unknown]: "❓",
  [RunContextType.Page]: "🌐",
  [RunContextType.ContentScript]: "📦",
  [RunContextType.ServiceWorker]: "⚙️",
  [RunContextType.SidePanel]: "🪟"
};

type ConsoleMethod = typeof console.log;

function formatLogMessage(appName: string, appVersion: string, key: string, contextIcon: string, message: string) {
  const now = new Date();
  const timestamp = now.toLocaleString();

  // Clean the message to remove any leading/trailing whitespace or invisible characters
  const cleanMessage = message.toString().trim().replace(/\s+/g, " ");

  return [
    `%c${appName}/v${appVersion}%c ${contextIcon} ${key}%c[${timestamp}]%c > ${cleanMessage}`,
    APP_VERSION_STYLE,
    LOG_NAME_STYLE,
    LOG_DATE_STYLE,
    "color: inherit",
  ];
}

function createLogFunction(method: ConsoleMethod, runContextType: RunContextType, key: string) {
  const contextIcon = CONTEXT_ICONS[runContextType] ?? CONTEXT_ICONS[RunContextType.Unknown];

  return (message: string | Error, ...data: any[]) => {
    let logMessage = typeof message === "string" ? message : `${message.message} ⚠️`;
    const logData = [...data];

    // Clean and trim the log message
    logMessage = logMessage.toString().trim();

    if (message instanceof Error) {
      logData.push("\n--- stack ---\n", message);
    }

    method(
      ...formatLogMessage(GlobalConstants.APP_NAME, GlobalConstants.APP_VERSION, key, contextIcon, logMessage),
      ...logData
    );
  };
}

export class Logger {
  public readonly key: string;
  public debug: (...args: any[]) => void;
  public error: (...args: any[]) => void;
  public info: (...args: any[]) => void;
  public log: (...args: any[]) => void;
  public warn: (...args: any[]) => void;

  constructor(private readonly runContextType: RunContextType, key: string) {
    this.key = key;
    this.debug = createLogFunction(console.debug, this.runContextType, this.key);
    this.error = createLogFunction(console.error, this.runContextType, this.key);
    this.info = createLogFunction(console.info, this.runContextType, this.key);
    this.log = createLogFunction(console.log, this.runContextType, this.key);
    this.warn = createLogFunction(console.warn, this.runContextType, this.key);
  }
}

