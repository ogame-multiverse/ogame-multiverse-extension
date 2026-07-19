export interface CallbackCommandActionMap {
  [action: string]: (...args: any[]) => any;
}

