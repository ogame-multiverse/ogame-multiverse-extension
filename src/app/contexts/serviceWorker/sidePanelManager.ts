import browser from 'webextension-polyfill';
import { Logger } from '../../logging/logger';
import { sidePanelBroadcastProtocolClient } from '../../messaging/sidePanelBroadcastProtocol';

const browserPolyfill = browser as typeof browser & {
    sidePanel: typeof chrome.sidePanel;
};

export class SidePanelManager {
    private readonly openWindowIds = new Set<number>();

    constructor(private readonly logger: Logger) { }

    public get IsSidebarActionBrowser(): boolean {
        return typeof (browser as any).sidebarAction !== 'undefined';
    }

    public Start(): void {
        this.SetupSidePanelBehavior();
        this.ListenPortConnections();
        void this.HydrateOpenWindowsAsync();
    }

    private async HydrateOpenWindowsAsync(): Promise<void> {
        try {
            const runtime = (globalThis as any).chrome?.runtime;
            if (typeof runtime?.getContexts !== 'function') return;

            const contexts: Array<{ windowId?: number }> = await runtime.getContexts({ contextTypes: ['SIDE_PANEL'] });
            for (const context of contexts) {
                if (typeof context.windowId === 'number' && context.windowId >= 0) {
                    this.openWindowIds.add(context.windowId);
                }
            }
        } catch (error) {
            this.logger.error('SidePanelManager.HydrateOpenWindowsAsync failed', error);
        }
    }

    private ListenPortConnections(): void {
        if (!browser?.runtime?.onConnect) return;

        browser.runtime.onConnect.addListener((port) => {
            if (port.name !== 'ogm-sidepanel-presence') return;

            let connectedWindowId: number | undefined;

            port.onMessage.addListener((msg: { type: string; windowId: number }) => {
                if (msg?.type === 'SIDEPANEL_INIT' && typeof msg.windowId === 'number') {
                    connectedWindowId = msg.windowId;
                    this.openWindowIds.add(connectedWindowId);
                    this.logger.debug(`SidePanel enregistré comme OUVERT pour windowId ${connectedWindowId}`);
                }
            });

            port.onDisconnect.addListener(() => {
                if (connectedWindowId !== undefined) {
                    this.openWindowIds.delete(connectedWindowId);
                    this.logger.debug(`SidePanel enregistré comme FERMÉ pour windowId ${connectedWindowId}`);
                }
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

    public IsSidePanelOpen(windowId: number): boolean {
        return this.openWindowIds.has(windowId);
    }

    public ToggleSidePanel(sender: browser.Runtime.MessageSender): void;
    public ToggleSidePanel(windowId: number): void;
    public ToggleSidePanel(senderOrWindowId: browser.Runtime.MessageSender | number): void {
        this.logger.debug('SidePanelManager.ToggleSidePanel called', senderOrWindowId);

        const windowId = typeof senderOrWindowId === 'number'
            ? senderOrWindowId
            : senderOrWindowId?.tab?.windowId;

        if (!windowId) {
            this.logger.error('SidePanelManager.ToggleSidePanel failed: windowId is undefined', senderOrWindowId);
            return;
        }

        try {
            if (this.IsSidePanelOpen(windowId)) {
                this.logger.debug(`SidePanelManager.ToggleSidePanel: closing side panel for windowId ${windowId}`);
                this.openWindowIds.delete(windowId);
                sidePanelBroadcastProtocolClient.ClosePanel(this.logger, windowId);
            } else {
                this.logger.debug(`SidePanelManager.ToggleSidePanel: opening side panel for windowId ${windowId}`);
                this.openWindowIds.add(windowId);
                if (this.IsSidebarActionBrowser) {
                    void (browserPolyfill as any).sidebarAction.open()
                        .catch((error: unknown) => {
                            this.openWindowIds.delete(windowId);
                            this.logger.error('SidePanelManager.OpenSidePanel failed', error);
                        });
                } else {
                    void browserPolyfill.sidePanel.open({ windowId })
                        .catch((error: unknown) => {
                            this.openWindowIds.delete(windowId);
                            this.logger.error('SidePanelManager.OpenSidePanel failed', error);
                        });
                }
            }
        } catch (error) {
            this.logger.error('SidePanelManager.ToggleSidePanel failed', error);
        }
    }
}