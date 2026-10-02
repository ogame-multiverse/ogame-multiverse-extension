import { defineWindowMessaging } from '@webext-core/messaging/page';
import { LocalizationStrings } from '../../types/LocalizationStrings';
import { GlobalConstants } from '../globalConstants';
import { Logger } from '../logging/logger';

export interface PageProtocol {
  GetLocalizationStrings(): Promise<LocalizationStrings>
  SendExtensionData(data: { universeKey: string, sessionData: any, localData: any }): Promise<void>
}

const serviceWorkerMessenger = defineWindowMessaging<PageProtocol>({
  namespace: GlobalConstants.APP_NAMESPACE
});

export class PageProtocolClient {
  // internal type-safe helper: if 'key' does not exist in PageProtocol, TS refuses to compile
  private send<K extends keyof PageProtocol>(
    logger: Logger,
    key: K,
    ...args: Parameters<PageProtocol[K]>
  ): ReturnType<PageProtocol[K]> {
    logger.debug(`Sending message for PageProtocol.${key}`, args[0]);
    return serviceWorkerMessenger.sendMessage(key as any, args[0]) as any
  }

  public GetLocalizationStringsAsync(logger: Logger) {
    return this.send(logger, 'GetLocalizationStrings')
  }

  public SendExtensionDataAsync(logger: Logger, universeKey: string, sessionData: any, localData: any) {
    return this.send(logger, 'SendExtensionData', { universeKey, sessionData, localData })
  }
}
export class PageProtocolRegistrar {
  private listen(logger: Logger, key: string, handler: Function): void {
    serviceWorkerMessenger.onMessage(key as any, ({ data, sender }: any) => {
      logger.debug(`Received message for PageProtocol.${key}`, data);
      return handler(data, sender);
    });
  }

  public OnGetLocalizationStrings(logger: Logger, handler: PageProtocol['GetLocalizationStrings']): void {
    this.listen(logger, 'GetLocalizationStrings', handler);
  }

  public OnSendExtensionData(logger: Logger, handler: PageProtocol['SendExtensionData']): void {
    this.listen(logger, 'SendExtensionData', handler);
  }
}

export const pageProtocolClient = new PageProtocolClient();
export const pageProtocolRegistrar = new PageProtocolRegistrar();