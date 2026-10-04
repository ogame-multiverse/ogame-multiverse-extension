import { DateUtils } from "../../../dateUtils";
import { Logger } from "../../../logging/logger";
import { OgameQueriesOptions } from "../../../messaging/data/ogameQueriesOptions";
import { ExtensionSessionData } from "../../../model/save/extensionSessionData";
import { SaveManager } from "../saveManager";
import { accountInfosApi, lifeformBonusesApi } from "./api/ogameDataExportApi";
import { OgameQueryResult } from "./ogameQueryResult";
import { OgameQueryResultValidator } from "./ogameQueryResultValidator";

export class OgameQuery {
    constructor(private readonly logger: Logger, private readonly saveManager: SaveManager) {
    }

    public async RunOgameQueriesAsync(
        universeKey: string,
        universeDomain: string,
        options: OgameQueriesOptions,
        abortSignal: AbortSignal = new AbortController().signal
    ): Promise<ExtensionSessionData> {
        this.logger.debug(`Running Ogame queries for universe ${universeKey} with options:`, options);

        const extensionSessionData = await this.saveManager.GetExtensionSessionDataAsync(universeKey);

        const results = new OgameQueryResult();
        let hasFailed = false;

        // Fetch and store account info if not already present
        if (OgameQueriesOptions.ShouldFetchAccountInfo(options, extensionSessionData.LastAccountInfoFetchDateISO)) {
            this.logger.info(`Fetching account info for universe ${universeKey} from domain ${universeDomain}`);
            try {
                results.AccountInfo = await accountInfosApi.FetchAsync(this.logger, abortSignal, universeDomain);
                results.LastAccountInfoFetchDateISO = DateUtils.NowAsIsoString();
                results.AccountInfoFetched = OgameQueryResultValidator.IsAccountInfoValid(results);
                if (!results.AccountInfoFetched) {
                    this.logger.error(`Account info received for universe ${universeKey} is missing expected properties`);
                }
            } catch (error) {
                this.logger.error(`Error fetching account info for universe ${universeKey} from domain ${universeDomain}:`, error);
                hasFailed = true;
            }
        }

        // Fetch and store lifeform bonuses if not already present
        if (!hasFailed && !abortSignal.aborted && OgameQueriesOptions.ShouldFetchLifeformBonuses(options, extensionSessionData.LastLifeformBonusesFetchDateISO)) {
            this.logger.info(`Fetching lifeform bonuses for universe ${universeKey} from domain ${universeDomain}`);
            try {
                results.LifeformBonuses = await lifeformBonusesApi.FetchAsync(this.logger, abortSignal, universeDomain);
                results.LastLifeformBonusesFetchDateISO = DateUtils.NowAsIsoString();
                results.LifeformBonusesFetched = OgameQueryResultValidator.IsLifeformBonusesValid(results);
                if (!results.LifeformBonusesFetched) {
                    this.logger.error(`Lifeform bonuses received for universe ${universeKey} are missing expected properties`);
                }
            } catch (error) {
                this.logger.error(`Error fetching lifeform bonuses for universe ${universeKey} from domain ${universeDomain}:`, error);
            }
        }

        if (OgameQueryResultValidator.HasAnyDataFetched(results)) {
            return await this.saveManager.UpdateExtensionSessionDataAsync(universeKey, (sessionData: ExtensionSessionData) => {
                if (results.AccountInfoFetched) {
                    sessionData.AccountInfo = results.AccountInfo;
                    sessionData.LastAccountInfoFetchDateISO = results.LastAccountInfoFetchDateISO;
                }
                if (results.LifeformBonusesFetched) {
                    sessionData.LifeformBonuses = results.LifeformBonuses;
                    sessionData.LastLifeformBonusesFetchDateISO = results.LastLifeformBonusesFetchDateISO;
                }
                return sessionData;
            });
        }

        return extensionSessionData;
    }
}