import browser from 'webextension-polyfill';
import { Logger } from '../../logging/logger';

const browserPolyfill = browser as typeof browser & {
  sidePanel: typeof chrome.sidePanel;
};

export class SidePanelManager {
  private readonly activePorts = new Map<number, browser.Runtime.Port>();
  constructor(private readonly logger: Logger) {
    // Detects when a side panel is opened and keeps track of the active ports for each window
    browser.runtime.onConnect.addListener((port) => {
      if (!port.name.startsWith('sidepanel-')) return;

      const windowId = parseInt(port.name.split('-')[1], 10);
      this.activePorts.set(windowId, port);

      // Listen for messages from the side panel
      port.onDisconnect.addListener(() => {
        this.activePorts.delete(windowId);
      });
    });
  }
  public Start(): void {
    try {
      if (!browserPolyfill?.sidePanel) return;

      if (typeof browserPolyfill.sidePanel.setPanelBehavior === 'function') {
        void browserPolyfill.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => console.debug('setPanelBehavior failed', error));
      }
    } catch (error) {
      this.logger.error('SidePanelManager.Start failed', error);
    }
  }

  public ToggleSidePanel(sender: browser.Runtime.MessageSender): void {
    const windowId = sender?.tab?.windowId;
    const port = this.activePorts.get(windowId);
    if (port) {
      // If the port is already active, send a message to close the side panel
      port.postMessage({ action: 'CLOSE' });
    } else {
      // If the port is not active, open the side panel
      browserPolyfill.sidePanel.open({ windowId }).
        catch((error: unknown) => {
          this.logger.error('SidePanelManager.ToggleSidePanel failed', error);
        });
    }
  }
}
