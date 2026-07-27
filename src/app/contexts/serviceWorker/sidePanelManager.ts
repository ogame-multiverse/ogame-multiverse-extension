import browser from 'webextension-polyfill';
import { browserInfo } from '../../dom/browserInfos';
import { Logger } from '../../logging/logger';
import { sidePanelBroadcastProtocolClient } from '../../messaging/sidePanelBroadcastProtocol';

const browserPolyfill = browser as typeof browser & {
    sidePanel: typeof chrome.sidePanel;
};

export class SidePanelManager {
    private readonly openWindowIds = new Set<number>();

    constructor(private readonly logger: Logger) { }

    public Start(): void {
        this.SetupSidePanelBehavior();
        this.ListenPortConnections();
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
                if (browserInfo.IsFirefox) {
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