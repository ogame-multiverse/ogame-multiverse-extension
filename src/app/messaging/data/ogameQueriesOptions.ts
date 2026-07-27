import { DateUtils, DateInput } from "../../dateUtils";

const ACCOUNT_INFO_FETCH_INTERVAL_MS = DateUtils.TenMinutesInMilliseconds;
const LIFEFORM_BONUSES_FETCH_INTERVAL_MS = DateUtils.OneHourInMilliseconds;
const TECH_QUANTITIES_FETCH_INTERVAL_MS = DateUtils.OneHourInMilliseconds;
const IMPORT_EXPORT_FETCH_INTERVAL_MS = DateUtils.FifteenMinutesInMilliseconds;

export class OgameQueriesOptions {
  public ForceAccountInfoFetch: boolean = false;
  public AllowFetchAccountInfo: boolean = false;

  public ForceLifeformBonusesFetch: boolean = false;
  public AllowFetchLifeformBonuses: boolean = false;

  public ForceTechQuantitiesFetch: boolean = false;
  public AllowFetchTechQuantities: boolean = false;

  public ForceImportExportFetch: boolean = false;
  public AllowFetchImportExport: boolean = false;

  public ForcePlayersFetch: boolean = false;
  public AllowFetchPlayers: boolean = false;

  public ForcePositionsFetch: boolean = false;
  public AllowFetchPositions: boolean = false;

  public ForceServerFetch: boolean = false;
  public AllowFetchServer: boolean = false;

  constructor(data: Partial<OgameQueriesOptions> = {}) {
    this.ForceAccountInfoFetch = data.ForceAccountInfoFetch ?? false;
    this.AllowFetchAccountInfo = (data.AllowFetchAccountInfo || this.ForceAccountInfoFetch) ?? false;

    this.ForceLifeformBonusesFetch = data.ForceLifeformBonusesFetch ?? false;
    this.AllowFetchLifeformBonuses = (data.AllowFetchLifeformBonuses || this.ForceLifeformBonusesFetch) ?? false;


    this.ForceTechQuantitiesFetch = data.ForceTechQuantitiesFetch ?? false;
    this.AllowFetchTechQuantities = (data.AllowFetchTechQuantities || this.ForceTechQuantitiesFetch) ?? false;

    this.ForceImportExportFetch = data.ForceImportExportFetch ?? false;
    this.AllowFetchImportExport = (data.AllowFetchImportExport || this.ForceImportExportFetch) ?? false;

    this.ForcePlayersFetch = data.ForcePlayersFetch ?? false;
    this.AllowFetchPlayers = (data.AllowFetchPlayers || this.ForcePlayersFetch) ?? false;

    this.ForcePositionsFetch = data.ForcePositionsFetch ?? false;
    this.AllowFetchPositions = (data.AllowFetchPositions || this.ForcePositionsFetch) ?? false;

    this.ForceServerFetch = data.ForceServerFetch ?? false;
    this.AllowFetchServer = (data.AllowFetchServer || this.ForceServerFetch) ?? false;
  }

  public static AccountAndLifeformBonusesAllowed(): OgameQueriesOptions {
    return new OgameQueriesOptions({ AllowFetchAccountInfo: true, AllowFetchLifeformBonuses: true });
  }
  public static AccountAndLifeformBonusesForced(): OgameQueriesOptions {
    return new OgameQueriesOptions({ ForceAccountInfoFetch: true, ForceLifeformBonusesFetch: true });
  }

  public static HasAnyFetchEnabled(options: OgameQueriesOptions): boolean {
    return options.AllowFetchAccountInfo || options.AllowFetchLifeformBonuses || options.AllowFetchTechQuantities || options.AllowFetchImportExport || options.AllowFetchPlayers || options.AllowFetchPositions || options.AllowFetchServer;
  }

  public static HasAnyFetchForced(options: OgameQueriesOptions): boolean {
    return options.ForceAccountInfoFetch || options.ForceLifeformBonusesFetch || options.ForceTechQuantitiesFetch || options.ForceImportExportFetch || options.ForcePlayersFetch || options.ForcePositionsFetch || options.ForceServerFetch;
  }

    public static ShouldFetchAccountInfo(options: OgameQueriesOptions, lastSyncDate: DateInput | undefined): boolean {
    return options.ForceAccountInfoFetch || (options.AllowFetchAccountInfo && DateUtils.DateIsObsolete(lastSyncDate, ACCOUNT_INFO_FETCH_INTERVAL_MS));
  }

    public static ShouldFetchLifeformBonuses(options: OgameQueriesOptions, lastSyncDate: DateInput | undefined): boolean {
    return options.ForceLifeformBonusesFetch || (options.AllowFetchLifeformBonuses && DateUtils.DateIsObsolete(lastSyncDate, LIFEFORM_BONUSES_FETCH_INTERVAL_MS));
  }

    public static ShouldFetchTechQuantities(options: OgameQueriesOptions, lastSyncDate: DateInput | undefined): boolean {
    return options.ForceTechQuantitiesFetch || (options.AllowFetchTechQuantities && DateUtils.DateIsObsolete(lastSyncDate, TECH_QUANTITIES_FETCH_INTERVAL_MS));
  }

    public static ShouldFetchImportExport(options: OgameQueriesOptions, lastSyncDate: DateInput | undefined): boolean {
    return options.ForceImportExportFetch || (options.AllowFetchImportExport && DateUtils.DateIsObsolete(lastSyncDate, IMPORT_EXPORT_FETCH_INTERVAL_MS));
  }
}