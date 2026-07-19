/**
 * Defines the structure for messages sent between extension scripts (Content/Popup to Background).
 * @template TPayload The data payload of the message.
 */
export interface InternalMessage<TType extends string = string, TPayload = unknown> {
  type: TType; // A unique identifier for the message purpose (e.g., 'GET_SETTINGS', 'SAVE_CACHE').
  payload?: TPayload; // The data associated with the request.
}

