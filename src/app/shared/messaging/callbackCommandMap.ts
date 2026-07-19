import { CallbackCommandActionMap } from "./callbackCommandActionMap";

export interface CallbackCommandMap {
  [command: string]: CallbackCommandActionMap;
}

