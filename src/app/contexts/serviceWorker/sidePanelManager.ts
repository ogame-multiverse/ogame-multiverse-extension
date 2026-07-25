import { Logger } from '../../logging/logger';

const chromeApi = (globalThis as { chrome?: any }).chrome;
export class SidePanelManager {
  constructor(private readonly logger: Logger) { }
  public Start(): void {
    try {
      if (!chromeApi?.sidePanel) return;

      if (typeof chromeApi.sidePanel.setPanelBehavior === 'function') {
        void chromeApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => console.debug('setPanelBehavior failed', error));
      }
    } catch (error) {
      this.logger.error('SidePanelManager.Start failed', error);
    }
  }

  public OpenSidePanel(sender: chrome.runtime.MessageSender): void {
    const tabId = sender?.tab?.id;
    if (!tabId) return;

    chromeApi.sidePanel.open({ tabId }).catch((error: unknown) => {
      this.logger.error('SidePanelManager.OpenSidePanel failed', error);
    });
  }
}
