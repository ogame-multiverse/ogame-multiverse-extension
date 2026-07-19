export interface RequestCallbackEvent {
  referer: string; // Unique request identifier
  command: string; // Main command group
  action: string; // Callback function to execute
  args: (string | number | boolean | undefined | null)[]; // Arguments
}