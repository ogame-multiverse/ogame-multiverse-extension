import { defineWindowMessaging } from '@webext-core/messaging/page';
import { LocalizationStrings } from '../../types/LocalizationStrings';
import { Logger } from '../logging/logger';
import { GlobalConstants } from '../globalConstants';

export interface ContentProtocol {
  PageContextStarted(data: { universeName:string, universeDomain: string, language: string, localizationStrings: LocalizationStrings }): Promise<void>
}

const contentMessenger = defineWindowMessaging<ContentProtocol>({
  namespace: GlobalConstants.APP_NAMESPACE
});

export class ContentProtocolClient {
  // internal type-safe helper: if 'key' does not exist in PageProtocol, TS refuses to compile
  private send<K extends keyof ContentProtocol>(
    logger: Logger,
    key: K,
    ...args: Parameters<ContentProtocol[K]>
  ): ReturnType<ContentProtocol[K]> {
    logger.debug(`Sending message for ContentProtocol.${key}`, args[0]);
    return contentMessenger.sendMessage(key as any, args[0]) as any
  }

  public PageContextStarted(logger: Logger, universeName: string, universeDomain: string, language: string, localizationStrings: LocalizationStrings) {
    return this.send(logger, 'PageContextStarted', { universeName, universeDomain, language, localizationStrings })
  }
}
export class ContentProtocolRegistrar {
  private listen(logger: Logger, key: string, handler: Function): void {
    contentMessenger.onMessage(key as any, ({ data, sender }: any) => {
      logger.debug(`Received message for ContentProtocol.${key}`, data);
      return handler(data, sender);
    });
  }

  public OnPageContextStarted(logger: Logger, handler: ContentProtocol['PageContextStarted']): void {
    this.listen(logger, 'PageContextStarted', handler);
  }
}

export const contentProtocolClient = new ContentProtocolClient();
export const contentProtocolRegistrar = new ContentProtocolRegistrar();