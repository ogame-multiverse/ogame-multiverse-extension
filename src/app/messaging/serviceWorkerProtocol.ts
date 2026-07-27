import { defineExtensionMessaging } from '@webext-core/messaging';
import browser from 'webextension-polyfill';
import { LocalizationStrings } from '../../types/LocalizationStrings';
import { GlobalConstants } from '../globalConstants';
import { Logger } from '../logging/logger';
import { FlyingFleetEvent } from '../model/flyingFleetEvent';
import { ExtensionSessionData } from '../model/save/extensionSessionData';
import { LocalizationData } from '../model/save/localizationData';
import { SidePanelUniverseCounters } from '../model/sidePanel/sidePanelUniverseCounters';
import { SidePanelUniversesSections } from '../model/sidePanel/sidePanelUniversesSections';
import { UniverseLayoutConfig } from '../model/sidePanel/universeLayoutConfig';
import { UniverseSidePanelOptions } from '../model/sidePanel/universeSidePanelOptions';
import { OgameDomData } from './../dom/ogameDom/ogameDomData';
import { OgameQueriesOptions } from './data/ogameQueriesOptions';
import { UniverseFleetEventItem } from './data/universeFleetEventItem';
import { SidePanelGlobalOptions } from '../model/sidePanel/sidePanelGlobalOptions';

export interface ServiceWorkerProtocol {



    /* LOCALIZATION */
    GetLocalizationData(universeKey: string): Promise<LocalizationData>,
    SaveLocalizationStrings(data: { universeKey: string, language: string, localizationStrings: LocalizationStrings; }): Promise<void>,

    ApplyDomData(data: { universeKey: string, data: OgameDomData }): Promise<void>,


    GetExtensionData(universeKey: string): Promise<{ sessionData: ExtensionSessionData, localizationData: LocalizationData }>,
    RunOgameQueries(data: { universeKey: string, universeDomain: string, options: OgameQueriesOptions }): Promise<void>,
    RegisterUniverse(data: { universeKey: string, universeName: string, universeDomain: string, lastRefreshDate: number }): Promise<void>
    UpdateUniverseStatus(data: { universeKey: string, universeCounters: SidePanelUniverseCounters, flyingFleetEvents: FlyingFleetEvent[] }): Promise<void>
    GetUniversesStatuses(mode: 'list' | 'grid'): Promise<SidePanelUniversesSections>
    ActionOnUniverseTab(data: { universeKey: string, action: 'activate' | 'move' | 'close' | 'refresh', windowId: number }): Promise<void>
    RemoveUniverse(universeKey: string): Promise<void>
    GetUniverseSidePanelOptions(universeKey: string): Promise<UniverseSidePanelOptions>
    SaveUniverseSidePanelOptions(data: { universeKey: string, options: UniverseSidePanelOptions }): Promise<void>
    SaveUniverseLayout(layout: UniverseLayoutConfig): Promise<UniverseLayoutConfig>
    ToggleSidePanel(): void,
    GetAllFlyingFleetEvents(universeKey?: string): Promise<UniverseFleetEventItem[]>
    GetSidePanelGlobalOptions(): Promise<SidePanelGlobalOptions>
    SaveSidePanelGlobalOptions(options: SidePanelGlobalOptions): Promise<void>
}

const serviceWorkerMessenger = defineExtensionMessaging<ServiceWorkerProtocol>()

export class ServiceWorkerProtocolClient {
    private send<K extends keyof ServiceWorkerProtocol>(
        logger: Logger,
        key: K,
        ...args: Parameters<ServiceWorkerProtocol[K]>
    ): ReturnType<ServiceWorkerProtocol[K]> {
        if (GlobalConstants.PROTOCOL_LOGGING_ENABLED) logger.debug(`Sending message for ServiceWorkerProtocol.${key}`, args[0]);
        return serviceWorkerMessenger.sendMessage(key as any, args[0]) as any
    }


    /* LOCALIZATION */
    public GetLocalizationDataAsync(logger: Logger, universeKey: string) {
        return this.send(logger, 'GetLocalizationData', universeKey)
    }
    public SaveLocalizationStringsAsync(logger: Logger, universeKey: string, language: string, localizationStrings: LocalizationStrings) {
        return this.send(logger, 'SaveLocalizationStrings', { universeKey, language, localizationStrings })
    }

    public GetExtensionDataAsync(logger: Logger, universeKey: string) {
        return this.send(logger, 'GetExtensionData', universeKey)
    }

    public ApplyDomDataAsync(logger: Logger, universeKey: string, data: OgameDomData) {
        return this.send(logger, 'ApplyDomData', { universeKey, data })
    }

    public RunOgameQueries(logger: Logger, universeKey: string, universeDomain: string, options: OgameQueriesOptions) {
        return this.send(logger, 'RunOgameQueries', { universeKey, universeDomain, options })
    }

    public RegisterUniverseAsync(logger: Logger, universeKey: string, universeName: string, universeDomain: string, lastRefreshDate: number) {
        return this.send(logger, 'RegisterUniverse', { universeKey, universeName, universeDomain, lastRefreshDate })
    }

    public UpdateUniverseStatusAsync(logger: Logger, universeKey: string, universeCounters: SidePanelUniverseCounters, flyingFleetEvents: FlyingFleetEvent[]) {
        return this.send(logger, 'UpdateUniverseStatus', { universeKey, universeCounters, flyingFleetEvents })
    }

    public GetUniversesStatusesAsync(logger: Logger, mode: 'list' | 'grid') {
        return this.send(logger, 'GetUniversesStatuses', mode)
    }

    public ActionOnUniverseTabAsync(logger: Logger, universeKey: string, action: 'activate' | 'move' | 'close' | 'refresh', windowId: number) {
        return this.send(logger, 'ActionOnUniverseTab', { universeKey, action, windowId })
    }

    public RemoveUniverseAsync(logger: Logger, universeKey: string) {
        return this.send(logger, 'RemoveUniverse', universeKey)
    }

    public GetUniverseSidePanelOptionsAsync(logger: Logger, universeKey: string) {
        return this.send(logger, 'GetUniverseSidePanelOptions', universeKey)
    }

    public SaveUniverseSidePanelOptionsAsync(logger: Logger, universeKey: string, options: UniverseSidePanelOptions) {
        return this.send(logger, 'SaveUniverseSidePanelOptions', { universeKey, options })
    }

    public SaveUniverseLayoutAsync(logger: Logger, layout: UniverseLayoutConfig) {
        return this.send(logger, 'SaveUniverseLayout', layout)
    }

    public ToggleSidePanel(logger: Logger) {
        return this.send(logger, 'ToggleSidePanel');
    }
    public GetAllFlyingFleetEventsAsync(logger: Logger, universeKey?: string) {
        return this.send(logger, 'GetAllFlyingFleetEvents', universeKey);
    }

    public GetSidePanelGlobalOptionsAsync(logger: Logger) {
        return this.send(logger, 'GetSidePanelGlobalOptions');
    }

    public SaveSidePanelGlobalOptionsAsync(logger: Logger, options: SidePanelGlobalOptions) {
        return this.send(logger, 'SaveSidePanelGlobalOptions', options);
    }
}

export class ServiceWorkerProtocolRegistrar {
    private listen(logger: Logger, key: string, handler: Function): void {
        serviceWorkerMessenger.onMessage(key as any, ({ data, sender }: any) => {
            if (GlobalConstants.PROTOCOL_LOGGING_ENABLED) logger.debug(`Received message for ServiceWorkerProtocol.${key}`, data);
            return handler(data, sender);
        });
    }

    /* LOCALIZATION */
    public OnSaveLocalizationStrings(logger: Logger, handler: ServiceWorkerProtocol['SaveLocalizationStrings']): void {
        this.listen(logger, 'SaveLocalizationStrings', handler);
    }
    public OnGetLocalizationData(logger: Logger, handler: ServiceWorkerProtocol['GetLocalizationData']): void {
        this.listen(logger, 'GetLocalizationData', handler);
    }


    public OnGetExtensionData(logger: Logger, handler: ServiceWorkerProtocol['GetExtensionData']): void {
        this.listen(logger, 'GetExtensionData', handler);
    }


    public OnRunOgameQueries(logger: Logger, handler: ServiceWorkerProtocol['RunOgameQueries']): void {
        this.listen(logger, 'RunOgameQueries', handler);
    }

    public OnApplyDomData(logger: Logger, handler: ServiceWorkerProtocol['ApplyDomData']): void {
        this.listen(logger, 'ApplyDomData', handler);
    }

    public OnRegisterUniverse(logger: Logger, handler: ServiceWorkerProtocol['RegisterUniverse']): void {
        this.listen(logger, 'RegisterUniverse', handler);
    }

    public OnUpdateUniverseStatus(logger: Logger, handler: ServiceWorkerProtocol['UpdateUniverseStatus']): void {
        this.listen(logger, 'UpdateUniverseStatus', handler);
    }

    public OnGetUniversesStatuses(logger: Logger, handler: ServiceWorkerProtocol['GetUniversesStatuses']): void {
        this.listen(logger, 'GetUniversesStatuses', handler);
    }

    public OnActionOnUniverseTab(logger: Logger, handler: ServiceWorkerProtocol['ActionOnUniverseTab']): void {
        this.listen(logger, 'ActionOnUniverseTab', handler);
    }

    public OnRemoveUniverse(logger: Logger, handler: ServiceWorkerProtocol['RemoveUniverse']): void {
        this.listen(logger, 'RemoveUniverse', handler);
    }

    public OnGetUniverseSidePanelOptions(logger: Logger, handler: ServiceWorkerProtocol['GetUniverseSidePanelOptions']): void {
        this.listen(logger, 'GetUniverseSidePanelOptions', handler);
    }

    public OnSaveUniverseSidePanelOptions(logger: Logger, handler: ServiceWorkerProtocol['SaveUniverseSidePanelOptions']): void {
        this.listen(logger, 'SaveUniverseSidePanelOptions', handler);
    }

    public OnSaveUniverseLayout(logger: Logger, handler: ServiceWorkerProtocol['SaveUniverseLayout']): void {
        this.listen(logger, 'SaveUniverseLayout', handler);
    }

    public OnToggleSidePanel(logger: Logger, handler: (data: void, sender: browser.Runtime.MessageSender) => void): void {
        this.listen(logger, 'ToggleSidePanel', handler);
    }

    public OnGetAllFlyingFleetEvents(logger: Logger, handler: ServiceWorkerProtocol['GetAllFlyingFleetEvents']): void {
        this.listen(logger, 'GetAllFlyingFleetEvents', handler);
    }

    public OnGetSidePanelGlobalOptions(logger: Logger, handler: ServiceWorkerProtocol['GetSidePanelGlobalOptions']): void {
        this.listen(logger, 'GetSidePanelGlobalOptions', handler);
    }

    public OnSaveSidePanelGlobalOptions(logger: Logger, handler: ServiceWorkerProtocol['SaveSidePanelGlobalOptions']): void {
        this.listen(logger, 'SaveSidePanelGlobalOptions', handler);
    }
}

export const serviceWorkerProtocolClient = new ServiceWorkerProtocolClient();
export const serviceWorkerProtocolRegistrar = new ServiceWorkerProtocolRegistrar();