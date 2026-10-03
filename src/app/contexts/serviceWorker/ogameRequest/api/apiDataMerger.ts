import { Logger } from "@webext-core/messaging";
import { GlobalConstants } from "../../../../globalConstants";
import { Account } from "../../../../model/account";
import { Moon } from "../../../../model/moon";
import { Planet } from "../../../../model/planet";
import { ExtensionLocalData } from "../../../../model/save/extensionLocalData";
import { SaveManager } from "../../saveManager";
import { OgameQueryResult } from "../ogameQuery";
import { ApiDataParser } from "./apiDataParser";
import { dataCalculator } from "../../dataCalculator";

export class ApiDataMerger {

    constructor(private readonly logger: Logger, private readonly saveManager: SaveManager, private readonly apiDataParser: ApiDataParser) { }

    private async SaveRawDataToSessionStorageAsync(universeKey: string, results: OgameQueryResult): Promise<void> {
        // Save the session data back to session storage if any new data was fetched
        if (GlobalConstants.STORE_OGAME_QUERIES_RESULTS_TO_SESSION_STORAGE) {
            this.logger.debug(`Saving raw Ogame query results to session storage for universe ${universeKey}`);

            // Retrieve the current session data for the universe from storage
            const universeSessionData = await this.saveManager.GetExtensionSessionDataAsync(universeKey);

            // Update the session data with the fetched results, only if they were fetched
            universeSessionData.AccountInfo = results.AccountInfoFetched ? results.AccountInfo : universeSessionData.AccountInfo;
            universeSessionData.LastAccountInfoFetchDateISO = results.AccountInfoFetched ? results.LastAccountInfoFetchDateISO : universeSessionData.LastAccountInfoFetchDateISO;
            universeSessionData.LifeformBonuses = results.LifeformBonusesFetched ? results.LifeformBonuses : universeSessionData.LifeformBonuses;
            universeSessionData.LastLifeformBonusesFetchDateISO = results.LifeformBonusesFetched ? results.LastLifeformBonusesFetchDateISO : universeSessionData.LastLifeformBonusesFetchDateISO;
            universeSessionData.TechQuantities = results.TechQuantitiesFetched ? results.TechQuantities : universeSessionData.TechQuantities;
            universeSessionData.LastTechQuantitiesFetchDateISO = results.TechQuantitiesFetched ? results.LastTechQuantitiesFetchDateISO : universeSessionData.LastTechQuantitiesFetchDateISO;
            universeSessionData.ImportExport = results.ImportExportFetched ? results.ImportExport : universeSessionData.ImportExport;
            universeSessionData.LastImportExportFetchDateISO = results.ImportExportFetched ? results.LastImportExportFetchDateISO : universeSessionData.LastImportExportFetchDateISO;

            // Save the updated session data back to session storage
            await this.saveManager.SaveExtensionSessionDataAsync(universeKey, universeSessionData);
        }
    }

    private MergePlanets(account: Account, results: OgameQueryResult): void {
        this.logger.debug(`Merging planets for account ${account.Player.Name} (${account.Player.Id})`);
        const apiDataPlanets = this.apiDataParser.ParsePlanets(results.AccountInfo);
        if (!account.Planets) {
            account.Planets = apiDataPlanets;
            return;
        }

        const apiById = new Map<number, Planet>(apiDataPlanets.map(p => [p.Id, p]));
        const localIds = new Set<number>();

        const merged: Planet[] = [];
        for (const local of account.Planets) {
            const api = apiById.get(local.Id);
            if (!api) continue;
            local.Coordinates = api.Coordinates;
            local.MoonId = api.MoonId;
            local.LifeformType = api.LifeformType;
            local.Population = api.Population;
            local.AvailableEnergy = api.AvailableEnergy;
            local.Resources = api.Resources;
            local.Production = api.Production;
            local.Fleet = api.Fleet;
            local.Defence = api.Defence;
            local.Buildings = api.Buildings;
            local.Buffs = api.Buffs;
            local.LifeformBuildings = api.LifeformBuildings;
            local.LifeformResearch = api.LifeformResearch;
            merged.push(local);
            localIds.add(local.Id);
        }

        for (const api of apiDataPlanets) {
            if (!localIds.has(api.Id)) merged.push(api);
        }

        account.Planets = merged;
    }
    private MergeMoons(account: Account, results: OgameQueryResult): void {
        this.logger.debug(`Merging moons for account ${account.Player.Name} (${account.Player.Id})`);
        const apiDataMoons = this.apiDataParser.ParseMoons(results.AccountInfo);
        if (!account.Moons) {
            account.Moons = apiDataMoons;
            return;
        }

        const apiById = new Map<number, Moon>(apiDataMoons.map(m => [m.Id, m]));
        const localIds = new Set<number>();

        const merged: Moon[] = [];
        for (const local of account.Moons) {
            const api = apiById.get(local.Id);
            if (!api) continue;
            local.PlanetId = api.PlanetId;
            local.Coordinates = api.Coordinates;
            local.JumpGateLevel = api.JumpGateLevel;
            local.Resources = api.Resources;
            local.Production = api.Production;
            local.Fleet = api.Fleet;
            local.Defence = api.Defence;
            local.Buildings = api.Buildings;
            local.Buffs = api.Buffs;
            merged.push(local);
            localIds.add(local.Id);
        }

        for (const api of apiDataMoons) {
            if (!localIds.has(api.Id)) merged.push(api);
        }

        account.Moons = merged;
    }

    public async MergeOgameQueryResultAsync(extensionLocalData: ExtensionLocalData, results: OgameQueryResult): Promise<ExtensionLocalData> {
        // No universe key or no data fetched => nothing to merge
        if (!extensionLocalData.UniverseKey || !OgameQueryResult.HasAnyDataFetched(results)) {
            this.logger.debug(`No universe key or no data fetched for universe ${extensionLocalData.UniverseKey}, skipping merge`, { results });
            return extensionLocalData;
        };

        // Save the raw data to session storage for debugging purposes
        await this.SaveRawDataToSessionStorageAsync(extensionLocalData.UniverseKey, results);



        const merged = await this.saveManager.UpdateExtensionLocalDataAsync(extensionLocalData.UniverseKey, (data) => {

            if (results.AccountInfoFetched || results.LifeformBonusesFetched) {

                if (results.AccountInfoFetched) {
                    this.logger.debug(`Merging account info for universe ${data.UniverseKey}`, { results });
                    data.LastAccountInfoFetchDateISO = results.LastAccountInfoFetchDateISO;

                    // Parse and update player and alliance classes based on the fetched account info
                    data.Account.Player.Class = this.apiDataParser.ParsePlayerClass(results.AccountInfo);
                    if (data.Account.Alliance) {
                        data.Account.Alliance.Class = this.apiDataParser.ParseAllianceClass(results.AccountInfo);
                    }

                    this.MergePlanets(data.Account, results);
                    this.MergeMoons(data.Account, results);
                    data.Account.Officers = this.apiDataParser.ParseOfficers(results.AccountInfo);
                    data.Account.Buffs = this.apiDataParser.ParseAccountBuffs(results.AccountInfo);
                    data.Account.Researches = this.apiDataParser.ParseResearches(results.AccountInfo);
                }

                if (results.LifeformBonusesFetched) {
                    data.LastLifeformBonusesFetchDateISO = results.LastLifeformBonusesFetchDateISO;
                    data.LocalizationData.TechsLocalizations = this.apiDataParser.ParseTechsLocalizations(results.LifeformBonuses);
                    data.Account.LifeformBonuses = this.apiDataParser.ParseLifeformBonuses(results.LifeformBonuses);
                }

                data.Account.CalculatedData.MaximumExpeditionSlots = dataCalculator.CalculateMaximumExpeditionSlots(data.Account);
                data.Account.CalculatedData.MaximumFleetSlots = dataCalculator.CalculateMaximumFleetSlots(data.Account);
            }

            return data;
        });

        extensionLocalData.Account = merged.Account;
        extensionLocalData.LocalizationData = merged.LocalizationData;
        extensionLocalData.LastAccountInfoFetchDateISO = merged.LastAccountInfoFetchDateISO;
        extensionLocalData.LastLifeformBonusesFetchDateISO = merged.LastLifeformBonusesFetchDateISO;

        return extensionLocalData;
    }
}