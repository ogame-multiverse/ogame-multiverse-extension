import browser from 'webextension-polyfill';
import { browserInfo } from '../../dom/browserInfos';
import { Logger } from '../../logging/logger';
import { sidePanelProtocolClient } from '../../messaging/sidePanelProtocol';

const browserPolyfill = browser as typeof browser & {
  sidePanel: typeof chrome.sidePanel;
};

export class SidePanelManager {
  constructor(private readonly logger: Logger) {
    this.ListenPortConnections();
  }

  public Start(): void {
    this.SetupSidePanelBehavior();
  }

  private ListenPortConnections(): void {
    browser.runtime.onConnect.addListener((port) => {
      if (!port.name.startsWith('sidepanel-')) return;

      const windowId = parseInt(port.name.split('-')[1], 10);
      sidePanelProtocolClient.RegisterPort(this.logger, windowId, port);

      port.onDisconnect.addListener(() => {
        sidePanelProtocolClient.UnregisterPort(this.logger, windowId);
      });
    });
  }

  private SetupSidePanelBehavior(): void {
    try {
      if (!browserPolyfill?.sidePanel) return;

      if (typeof browserPolyfill.sidePanel.setPanelBehavior === 'function') {
        void browserPolyfill.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
          .catch((error: unknown) => this.logger.error('sidePanel.setPanelBehavior failed', error));
      }
    } catch (error) {
      this.logger.error('SidePanelManager.SetupSidePanelBehavior failed', error);
    }
  }

  private OpenSidePanel(windowId: number): void {

    if (browserInfo.IsFirefox) {
      (browserPolyfill as any).sidebarAction.open()
        .catch((error: unknown) => {
          this.logger.error('SidePanelManager.ToggleSidePanel failed', error);
        });
    }
    else {

      browserPolyfill.sidePanel.open({ windowId })
        .catch((error: unknown) => {
          this.logger.error('SidePanelManager.ToggleSidePanel failed', error);
        });
    }
  }

  public ToggleSidePanel(sender: browser.Runtime.MessageSender): void;
  public ToggleSidePanel(windowId: number): void;
  public ToggleSidePanel(senderOrWindowId: browser.Runtime.MessageSender | number): void {
    const windowId = typeof senderOrWindowId === 'number'
      ? senderOrWindowId
      : senderOrWindowId?.tab?.windowId;

    if (!windowId) return;

    if (sidePanelProtocolClient.IsOpen(windowId)) {
      sidePanelProtocolClient.ClosePanel(this.logger, windowId);
    } else {
      this.OpenSidePanel(windowId);
    }
  }
}
