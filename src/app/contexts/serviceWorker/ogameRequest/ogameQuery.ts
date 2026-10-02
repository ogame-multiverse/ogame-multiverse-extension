import { DateUtils } from "../../../dateUtils";
import { Logger } from "../../../logging/logger";
import { OgameQueriesOptions } from "../../../messaging/data/ogameQueriesOptions";
import { ExtensionLocalData } from "../../../model/save/extensionLocalData";
import { accountInfosApi, lifeformBonusesApi /*, techQuantitiesApi, importExportInfosApi*/ } from "./api/dataExportApi";

export class OgameQueryResult {
    public AccountInfoFetched: boolean = false;
    public LastAccountInfoFetchDateISO: string | undefined;
    public AccountInfo: any;

    public LifeformBonusesFetched: boolean = false;
    public LastLifeformBonusesFetchDateISO: string | undefined;
    public LifeformBonuses: any;

    public TechQuantitiesFetched: boolean = false;
    public LastTechQuantitiesFetchDateISO: string | undefined;
    public TechQuantities: any;

    public ImportExportFetched: boolean = false;
    public LastImportExportFetchDateISO: string | undefined;
    public ImportExport: any;

    public static HasAnyDataFetched(result: OgameQueryResult): boolean {
        return result.AccountInfoFetched || result.LifeformBonusesFetched || result.TechQuantitiesFetched || result.ImportExportFetched;
    }
}

export class OgameQuery {
    constructor(private readonly logger: Logger) {
    }

    public async RunOgameQueriesAsync(extensionLocalData: ExtensionLocalData, universeDomain: string, options: OgameQueriesOptions): Promise<OgameQueryResult> {
        this.logger.debug(`Running Ogame queries for universe ${extensionLocalData.UniverseKey} with options:`, options);

        const tasks: Promise<void>[] = [];
        const results = new OgameQueryResult();

        const abortController = new AbortController();

        // Fetch and store account info if not already present
        if (OgameQueriesOptions.ShouldFetchAccountInfo(options, extensionLocalData.LastAccountInfoFetchDateISO)) {
            this.logger.info(`Fetching account info for universe ${extensionLocalData.UniverseKey} from domain ${universeDomain}`);

            tasks.push(
                accountInfosApi.FetchAsync(this.logger, abortController.signal, universeDomain).then(data => {
                    results.AccountInfo = data;
                    results.LastAccountInfoFetchDateISO = DateUtils.NowAsIsoString();
                    results.AccountInfoFetched = true;
                })
            );
        }

        // Fetch and store lifeform bonuses if not already present
        if (OgameQueriesOptions.ShouldFetchLifeformBonuses(options, extensionLocalData.LastLifeformBonusesFetchDateISO)) {
            this.logger.info(`Fetching lifeform bonuses for universe ${extensionLocalData.UniverseKey} from domain ${universeDomain}`);

            tasks.push(
                lifeformBonusesApi.FetchAsync(this.logger, abortController.signal, universeDomain).then(data => {
                    results.LifeformBonuses = data;
                    results.LastLifeformBonusesFetchDateISO = DateUtils.NowAsIsoString();
                    results.LifeformBonusesFetched = true;
                })
            );
        }

        // Fetch and store tech quantities if not already present
        /*
            if (!universeSessionData.TechQuantities || OgameQueriesOptions.ShouldFetchTechQuantities(options, universeSessionData.LastTechQuantitiesFetchDateISO)) {
              this.logger.info(`Fetching tech quantities for universe ${universeSessionData.UniverseKey} from domain ${universeDomain}`);
              results.TechQuantities = await techQuantitiesApi.FetchAsync(this.logger, abortController.signal, universeDomain);
              results.LastTechQuantitiesFetchDateISO = DateUtils.NowAsIsoString();
              results.TechQuantitiesFetched = true;
            }
        */

        // Fetch and store import/export info if not already present
        /*
            if (!universeSessionData.ImportExport || OgameQueriesOptions.ShouldFetchImportExport(options, universeSessionData.LastImportExportFetchDateISO)) {
              this.logger.info(`Fetching import/export info for universe ${universeSessionData.UniverseKey} from domain ${universeDomain}`);
              results.ImportExport = await importExportInfosApi.FetchAsync(this.logger, abortController.signal, universeDomain);
              results.LastImportExportFetchDateISO = DateUtils.NowAsIsoString();
              results.ImportExportFetched = true;
            }
        */

        if (tasks.length > 0) {
            const settledResults = await Promise.allSettled(tasks);
            for (const res of settledResults) {
                if (res.status === 'rejected') {
                    this.logger.error(`A query failed during universe updates for ${extensionLocalData.UniverseKey}`, res.reason);
                }
            }
        }

        return results;
    }



}