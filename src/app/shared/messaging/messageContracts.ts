import { ExtensionLocalData } from '../save/extensionLocalData';
import { UniverseData } from '../universeData';
import { UniverseRegisterData } from '../UniverseRegisterData';

export interface MessageContract<TPayload = void, TResponse = void> {
  payload: TPayload;
  response: TResponse;
}

export type MessageContractMap = Record<string, MessageContract<unknown, unknown>>;

export type PayloadOf<TMap, TType extends keyof TMap> = TMap[TType] extends MessageContract<infer TPayload, unknown> ? TPayload : never;
export type ResponseOf<TMap, TType extends keyof TMap> = TMap[TType] extends MessageContract<unknown, infer TResponse> ? TResponse : never;

export type MaybePayloadArg<TPayload> = [TPayload] extends [void] ? [] | [payload: TPayload] : [payload: TPayload];



export interface SidePanelUniverseStatus {
  universeKey: string;
  universeDisplayName: string;
  isOpen: boolean;
  openTabsCount: number;
  newMessages: number;
  newChatMessages: number;
  hostileFleetCount: number;
  friendlyFleetCount: number;
  ownFleetCount: number;
  lastRefreshAtIso?: string;
  WarningThresholdMinutes: number;
  ShowHostileFleetIndicator: boolean;
  ShowFriendlyFleetIndicator: boolean;
  ShowOwnFleetIndicator: boolean;
  ShowUnreadMessagesIndicator: boolean;
  ShowUnreadChatMessagesIndicator: boolean;
}

export interface ServiceWorkerMessageMap {
  GET_EXTENSION_LOCAL_DATA: MessageContract<{ universeKey: string; }, ExtensionLocalData>;
  SAVE_EXTENSION_LOCAL_DATA: MessageContract<{ universeKey: string; localSave: ExtensionLocalData; }, void>;
  REGISTER_UNIVERSE: MessageContract<UniverseRegisterData, void>;

  UPDATE_UNIVERSE_STATUS: MessageContract<{ universeKey: string; universeData: UniverseData }, void>;
  LIST_UNIVERSE_STATUSES: MessageContract<{}, SidePanelUniverseStatus[]>;
  RELOAD_UNIVERSE_TAB: MessageContract<{ universeKey: string; openIfMissing?: boolean; openOnReloadTab?: boolean; ensureRefresh?: boolean }, { refreshed: boolean }>;
  REMOVE_UNIVERSE: MessageContract<{ universeKey: string; }, { removed: boolean }>;
}

