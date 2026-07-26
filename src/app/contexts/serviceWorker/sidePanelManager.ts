import browser from 'webextension-polyfill';
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

  public ToggleSidePanel(sender: browser.Runtime.MessageSender): void {
    const windowId = sender?.tab?.windowId;
    if (!windowId) return;

    if (sidePanelProtocolClient.IsOpen(windowId)) {
      // If open: close the panel
      sidePanelProtocolClient.ClosePanel(this.logger, windowId);
    } else {
      // If closed: open the panel
      browserPolyfill.sidePanel.open({ windowId })
        .catch((error: unknown) => {
          this.logger.error('SidePanelManager.ToggleSidePanel failed', error);
        });
    }
  }
}
