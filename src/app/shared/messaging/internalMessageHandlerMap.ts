/**
 * Maps message types to handler functions in the Background Script.
 */
export interface InternalMessageHandlerMap {
  [type: string]: (payload: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown> | unknown;
}
