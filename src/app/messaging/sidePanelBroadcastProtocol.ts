import { defineExtensionMessaging } from '@webext-core/messaging';
import { GlobalConstants } from '../globalConstants';
import { Logger } from '../logging/logger';
import { FlyingFleetEvent } from '../model/flyingFleetEvent';
import { SidePanelUniverseCounters } from '../model/sidePanel/sidePanelUniverseCounters';
import { UniverseSidePanelOptions } from '../model/sidePanel/universeSidePanelOptions';
import { SidePanelGlobalOptions } from '../model/sidePanel/sidePanelGlobalOptions';

export interface SidePanelBroadcastProtocol {
    UniverseRegistered(data: { universeKey: string, universeName: string, universeDomain: string, lastRefreshDate: number }): void
    UniverseStatusUpdated(data: { universeKey: string, universeCounters: SidePanelUniverseCounters, isOpen: boolean, flyingFleetEvents: FlyingFleetEvent[] }): void
    UpdateUniverseOpenState(data: { universeKey: string, isOpen: boolean }): void
    UpdateUniverseSidePanelOptions(data: { universeKey: string, options: UniverseSidePanelOptions }): void
    UpdateUniverseGrid(): void
    UniverseRemoved(universeKey: string): void
    UpdateSidePanelGlobalOptions(options: SidePanelGlobalOptions): void
    /** Asks the side panel of the given window to close itself (other windows ignore it). */
    ClosePanel(data: { windowId: number }): void
}

const sidePanelBroadcastMessenger = defineExtensionMessaging<SidePanelBroadcastProtocol>()

export class SidePanelBroadcastProtocolClient {
    /**
     * Broadcasts to every extension page listening (all open side panels).
     * No presence tracking needed: if no side panel is open, the browser rejects with
     * "Receiving end does not exist", which is expected and ignored.
     */
    private send<K extends keyof SidePanelBroadcastProtocol>(
        logger: Logger,
        key: K,
        ...args: Parameters<SidePanelBroadcastProtocol[K]>
    ): void {
        if (GlobalConstants.PROTOCOL_LOGGING_ENABLED) logger.debug(`Sending message for SidePanelBroadcastProtocol.${key}`, args[0]);

        (sidePanelBroadcastMessenger.sendMessage(key as any, args[0]) as Promise<unknown>)
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);
                if (message.includes('Receiving end does not exist')) {
                    if (GlobalConstants.PROTOCOL_LOGGING_ENABLED) logger.debug(`No open side panel for SidePanelBroadcastProtocol.${key}`);
                } else {
                    logger.warn(`Failed to send SidePanelBroadcastProtocol.${key}`, error);
                }
            });
    }

    public RegisterUniverse(logger: Logger, universeKey: string, universeName: string, universeDomain: string, lastRefreshDate: number) {
        return this.send(logger, 'UniverseRegistered', { universeKey, universeName, universeDomain, lastRefreshDate })
    }
    public UpdateUniverseStatus(logger: Logger, universeKey: string, universeCounters: SidePanelUniverseCounters, isOpen: boolean, flyingFleetEvents: FlyingFleetEvent[]) {
        return this.send(logger, 'UniverseStatusUpdated', { universeKey, universeCounters, isOpen, flyingFleetEvents });
    }
    public UpdateUniverseOpenState(logger: Logger, universeKey: string, isOpen: boolean) {
        return this.send(logger, 'UpdateUniverseOpenState', { universeKey, isOpen });
    }
    public UpdateUniverseSidePanelOptions(logger: Logger, universeKey: string, options: UniverseSidePanelOptions) {
        return this.send(logger, 'UpdateUniverseSidePanelOptions', { universeKey, options })
    }
    public UpdateUniverseGrid(logger: Logger) {
        return this.send(logger, 'UpdateUniverseGrid')
    }
    public RemoveUniverse(logger: Logger, universeKey: string) {
        return this.send(logger, 'UniverseRemoved', universeKey)
    }
    public UpdateSidePanelGlobalOptions(logger: Logger, options: SidePanelGlobalOptions) {
        return this.send(logger, 'UpdateSidePanelGlobalOptions', options)
    }
    public ClosePanel(logger: Logger, windowId: number) {
        return this.send(logger, 'ClosePanel', { windowId })
    }
}

export class SidePanelBroadcastProtocolRegistrar {
    private listen(logger: Logger, key: string, handler: Function): void {
        sidePanelBroadcastMessenger.onMessage(key as any, ({ data, sender }: any) => {
            if (GlobalConstants.PROTOCOL_LOGGING_ENABLED) logger.debug(`Received message for SidePanelBroadcastProtocol.${key}`, data);
            return handler(data, sender);
        });
    }

    public OnRegisterUniverse(logger: Logger, handler: SidePanelBroadcastProtocol['UniverseRegistered']): void {
        this.listen(logger, 'UniverseRegistered', handler);
    }

    public OnUpdateUniverseStatus(logger: Logger, handler: SidePanelBroadcastProtocol['UniverseStatusUpdated']): void {
        this.listen(logger, 'UniverseStatusUpdated', handler);
    }
    public OnUpdateUniverseOpenState(logger: Logger, handler: SidePanelBroadcastProtocol['UpdateUniverseOpenState']): void {
        this.listen(logger, 'UpdateUniverseOpenState', handler);
    }
    public OnUpdateUniverseSidePanelOptions(logger: Logger, handler: SidePanelBroadcastProtocol['UpdateUniverseSidePanelOptions']): void {
        this.listen(logger, 'UpdateUniverseSidePanelOptions', handler);
    }

    public OnUpdateUniverseGrid(logger: Logger, handler: SidePanelBroadcastProtocol['UpdateUniverseGrid']): void {
        this.listen(logger, 'UpdateUniverseGrid', handler);
    }

    public OnRemoveUniverse(logger: Logger, handler: SidePanelBroadcastProtocol['UniverseRemoved']): void {
        this.listen(logger, 'UniverseRemoved', handler);
    }

    public OnUpdateSidePanelGlobalOptions(logger: Logger, handler: SidePanelBroadcastProtocol['UpdateSidePanelGlobalOptions']): void {
        this.listen(logger, 'UpdateSidePanelGlobalOptions', handler);
    }

    public OnClosePanel(logger: Logger, handler: SidePanelBroadcastProtocol['ClosePanel']): void {
        this.listen(logger, 'ClosePanel', handler);
    }
}

export const sidePanelBroadcastProtocolClient = new SidePanelBroadcastProtocolClient();
export const sidePanelBroadcastProtocolRegistrar = new SidePanelBroadcastProtocolRegistrar();