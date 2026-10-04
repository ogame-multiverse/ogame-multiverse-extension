import { Logger } from "../../../../logging/logger";

const FETCH_TIMEOUT_MS = 30_000;

class OGameDataExportApi {
    constructor(private readonly endpoint: string) { }

    public async FetchAsync(logger: Logger, abortSignal: AbortSignal, universeDomain: string): Promise<any> {
        const url = `https://${universeDomain}${this.endpoint}`;
        logger.info(`Fetching data from ${url}`);

        const response = await fetch(url, {
            method: "GET",
            signal: AbortSignal.any([abortSignal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
            credentials: 'include',
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data from ${url}. Status: ${response.status}`);
        }

        let jsonResponse: any;
        try {
            jsonResponse = await response.json();
        } catch (error) {
            throw new Error(`Response from ${url} was not valid JSON: ${error}`);
        }

        logger.debug("Successfully fetched data", jsonResponse);
        return jsonResponse;
    }
}


const ACCOUNT_INFOS_ENDPOINT = "/game/index.php?page=componentOnly&component=externaldataexport&action=accountInfo&asJson=1";
const LIFEFORM_BONUSES_ENDPOINT = "/game/index.php?page=componentOnly&component=externaldataexport&action=speciesBonuses&asJson=1";
//const TECH_QUANTITIES_ENDPOINT = "/game/index.php?page=componentOnly&component=externaldataexport&action=technologyQuantities&asJson=1";
//const IMPORT_EXPORT_INFOS_ENDPOINT = "/game/index.php?page=componentOnly&component=externaldataexport&action=importExportInfo&asJson=1";


export const accountInfosApi = new OGameDataExportApi(ACCOUNT_INFOS_ENDPOINT);
export const lifeformBonusesApi = new OGameDataExportApi(LIFEFORM_BONUSES_ENDPOINT);
//export const techQuantitiesApi = new OGameDataExportApi(TECH_QUANTITIES_ENDPOINT);
//export const importExportInfosApi = new OGameDataExportApi(IMPORT_EXPORT_INFOS_ENDPOINT);