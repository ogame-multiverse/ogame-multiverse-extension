import { ContextMessaging } from '../shared/messaging/contextMessaging';
import { PayloadOf, ResponseOf, ServiceWorkerMessageMap } from '../shared/messaging/messageContracts';

type ServiceWorkerHandler<TType extends keyof ServiceWorkerMessageMap> = (
  payload: PayloadOf<ServiceWorkerMessageMap, TType>
) => Promise<ResponseOf<ServiceWorkerMessageMap, TType>> | ResponseOf<ServiceWorkerMessageMap, TType>;

export type ServiceWorkerHandlers = {
  [TType in keyof ServiceWorkerMessageMap]: ServiceWorkerHandler<TType>;
};

export class ServiceWorkerMessageRegistrar {
  public Register(handlers: ServiceWorkerHandlers): void {
    this.RegisterHandler('GET_EXTENSION_LOCAL_DATA', handlers.GET_EXTENSION_LOCAL_DATA);
    this.RegisterHandler('SAVE_EXTENSION_LOCAL_DATA', handlers.SAVE_EXTENSION_LOCAL_DATA);
    this.RegisterHandler('REGISTER_UNIVERSE', handlers.REGISTER_UNIVERSE);
    this.RegisterHandler('LIST_UNIVERSE_STATUSES', handlers.LIST_UNIVERSE_STATUSES);
    this.RegisterHandler('RELOAD_UNIVERSE_TAB', handlers.RELOAD_UNIVERSE_TAB);
    this.RegisterHandler('REMOVE_UNIVERSE', handlers.REMOVE_UNIVERSE);
    this.RegisterHandler('UPDATE_UNIVERSE_STATUS', handlers.UPDATE_UNIVERSE_STATUS);
  }

  private RegisterHandler<TType extends keyof ServiceWorkerMessageMap>(type: TType, handler: ServiceWorkerHandler<TType>): void {
    ContextMessaging.OnSW<ServiceWorkerMessageMap, TType>(type, handler);
  }
}
