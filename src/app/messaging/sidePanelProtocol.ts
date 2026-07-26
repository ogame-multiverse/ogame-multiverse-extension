import browser from 'webextension-polyfill';
import { Logger } from '../logging/logger';

// 1. Contrat des messages envoyés au SidePanel
export interface SidePanelProtocol {
  ClosePanel(): void;
  RefreshData(data: { universeKey: string }): void;
}

// Helper interne pour typer les messages transitant sur le Port
export interface SidePanelPortMessage<K extends keyof SidePanelProtocol = keyof SidePanelProtocol> {
  action: K;
  payload?: any;
}

// 2. Le Client (utilisé côté Service Worker)
export class SidePanelProtocolClient {
  private activePorts = new Map<number, browser.Runtime.Port>();

  public RegisterPort(logger: Logger, windowId: number, port: browser.Runtime.Port): void {
    this.activePorts.set(windowId, port);
    logger.debug(`Registered port for windowId ${windowId}`);
  }

  public UnregisterPort(logger: Logger, windowId: number): void {
    this.activePorts.delete(windowId);
    logger.debug(`Unregistered port for windowId ${windowId}`);
  }

  public IsOpen(windowId: number): boolean {
    return this.activePorts.has(windowId);
  }

  private send<K extends keyof SidePanelProtocol>(
    logger: Logger,
    windowId: number,
    action: K,
    payload?: any
  ): void {
    const port = this.activePorts.get(windowId);
    if (!port) {
      logger.warn(`No active port found for windowId ${windowId}`);
      return;
    }

    logger.debug(`Sending ${action} via Port to windowId ${windowId}`, payload);
    const message: SidePanelPortMessage<K> = { action, payload };
    port.postMessage(message);
  }

  public ClosePanel(logger: Logger, windowId: number): void {
    this.send(logger, windowId, 'ClosePanel');
  }
}


export class SidePanelProtocolRegistrar {
  private readonly handlers = new Map<string, Function>();

  public OpenPort(logger: Logger, windowId: number): browser.Runtime.Port {
    logger.debug(`Opening port for SidePanelProtocol with windowId ${windowId}`);
    try {
      return browser.runtime.connect({ name: `sidepanel-${windowId}` });
    }
    catch (error) {
      logger.error(`Failed to open port for SidePanelProtocol with windowId ${windowId}`, error);
      throw error;
    }
  }

  public Connect(logger: Logger, port: browser.Runtime.Port): void {
    port.onMessage.addListener((message: unknown) => {
      const msg = message as SidePanelPortMessage;
      if (!msg || !msg.action) return;

      const handler = this.handlers.get(msg.action);
      if (handler) {
        logger.debug(`Received message for SidePanelProtocol.${msg.action}`, msg.payload);
        handler(msg.payload);
      }
    });
  }

  public OnClosePanel(handler: () => void): void {
    this.handlers.set('ClosePanel', handler);
  }
}

export const sidePanelProtocolRegistrar = new SidePanelProtocolRegistrar();
export const sidePanelProtocolClient = new SidePanelProtocolClient();