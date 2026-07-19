import { ContextMessaging } from '../shared/messaging/contextMessaging';
import { ServiceWorkerMessageMap } from '../shared/messaging/messageContracts';

export class SidePanelSafeMessaging {
  private contextRecoveryTriggered = false;

  constructor(private readonly onContextInvalidated: () => void) { }

  public async SendP2SWSafe<TResponse>(type: keyof ServiceWorkerMessageMap, payload: unknown, fallback: TResponse): Promise<TResponse> {
    try {
      return (await ContextMessaging.SendP2SW<ServiceWorkerMessageMap, keyof ServiceWorkerMessageMap>({
        type: type as keyof ServiceWorkerMessageMap,
        payload: payload as never,
      })) as TResponse;
    } catch (error) {
      this.HandleContextMessagingError(error);
      return fallback;
    }
  }

  private HandleContextMessagingError(error: unknown): void {
    if (!this.IsContextInvalidatedError(error)) return;
    if (this.contextRecoveryTriggered) return;

    this.contextRecoveryTriggered = true;
    this.onContextInvalidated();
  }

  private IsContextInvalidatedError(error: unknown): boolean {
    const message = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error || '');
    const normalized = message.toLowerCase();

    return normalized.includes('extension context invalidated') || normalized.includes('receiving end does not exist') || normalized.includes('could not establish connection');
  }
}
