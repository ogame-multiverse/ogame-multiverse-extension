import { Account } from '../account';
import { FlyingFleetEvent } from '../flyingFleetEvent';
import { UniverseSidePanelOptions } from '../sidePanel/universeSidePanelOptions';
import { LocalizationData } from './localizationData';
export class ExtensionLocalData {

    public UniverseKey: string | undefined;
    public UniverseName: string | undefined;
    public UniverseNumber: number | undefined;
    public UniverseLanguage: string | undefined;
    public UniverseDomain: string | undefined;

    public LastRefreshDate?: number;

    public SidePanelOptions: UniverseSidePanelOptions;

    public Account: Account;

    
    public LastAccountInfoFetchDateISO: string | undefined;
    public LastLifeformBonusesFetchDateISO: string | undefined;

    /* Localization data from page context and lifeform bonuses api */
    public LocalizationData: LocalizationData;

    /* Flying fleet events data from content context */
    public FlyingFleetEvents: FlyingFleetEvent[];

    constructor(data: Partial<ExtensionLocalData>) {
        this.UniverseKey = data.UniverseKey;
        this.UniverseName = data.UniverseName;
        this.UniverseNumber = data.UniverseNumber;
        this.UniverseDomain = data.UniverseDomain;

        this.LastRefreshDate = data.LastRefreshDate;

        this.SidePanelOptions = new UniverseSidePanelOptions(data.SidePanelOptions || {});
        this.LocalizationData = data.LocalizationData ? new LocalizationData(data.LocalizationData) : new LocalizationData({});

        this.Account = data.Account ? new Account(data.Account) : new Account({});

        this.LastAccountInfoFetchDateISO = data.LastAccountInfoFetchDateISO;
        this.LastLifeformBonusesFetchDateISO = data.LastLifeformBonusesFetchDateISO;

        this.FlyingFleetEvents = data.FlyingFleetEvents ?? [];
    }
}