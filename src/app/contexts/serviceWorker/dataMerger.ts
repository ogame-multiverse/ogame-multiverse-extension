import { DataChanges } from "../../dataMutator";
import { GlobalConstants } from "../../globalConstants";
import { Logger } from "../../logging/logger";
import { Account } from "../../model/account";
import { CalculatedData } from "../../model/calculatedData";
import { Moon } from "../../model/moon";
import { Planet } from "../../model/planet";
import { ExtensionLocalData } from "../../model/save/extensionLocalData";
import { ExtensionSessionData } from "../../model/save/extensionSessionData";
import { dataCalculator } from "./dataCalculator";
import { OgameApiDataParser } from "./ogameRequest/api/ogameApiDataParser";
import { SaveManager } from "./saveManager";

export class DataMerger {
    constructor(private readonly logger: Logger, private readonly saveManager: SaveManager, private readonly apiDataParser: OgameApiDataParser) { }

    private SortByCoordinates<T extends { Coordinates: { Galaxy: number; System: number; Position: number } }>(items: T[]): T[] {
        return [...items].sort((a, b) =>
            a.Coordinates.Galaxy - b.Coordinates.Galaxy
            || a.Coordinates.System - b.Coordinates.System
            || a.Coordinates.Position - b.Coordinates.Position);
    }

    private KeepKnownNames<T extends { Id: number; Name?: string }>(items: T[], existing: T[] | undefined): T[] {
        if (!existing?.length) return items;
        const existingById = new Map(existing.map(e => [e.Id, e]));
        for (const item of items) {
            if (!item.Name) item.Name = existingById.get(item.Id)?.Name ?? item.Name;
        }
        return items;
    }

    private MergePlanets(fromPageData: Planet[] | undefined, fromApi: Planet[] | undefined): Planet[] {
        if (!fromPageData || fromPageData.length === 0) return fromApi ?? [];// If no page data, return API data
        else if (!fromApi || fromApi.length === 0) return fromPageData;// If no API data, return page data

        const apiById = new Map<number, Planet>(fromApi.map(p => [p.Id, p]));

        const merged: Planet[] = [];
        for (const planetFromPage of fromPageData) {
            const planetFromApi = apiById.get(planetFromPage.Id);
            if (planetFromApi) {
                planetFromPage.Coordinates = planetFromApi.Coordinates;
                planetFromPage.MoonId = planetFromApi.MoonId;
                planetFromPage.LifeformType = planetFromApi.LifeformType;
                planetFromPage.Population = planetFromApi.Population;
                planetFromPage.AvailableEnergy = planetFromApi.AvailableEnergy;
                planetFromPage.Resources = planetFromApi.Resources;
                planetFromPage.Production = planetFromApi.Production;
                planetFromPage.Fleet = planetFromApi.Fleet;
                planetFromPage.Defence = planetFromApi.Defence;
                planetFromPage.Buildings = planetFromApi.Buildings;
                planetFromPage.Buffs = planetFromApi.Buffs;
                planetFromPage.LifeformBuildings = planetFromApi.LifeformBuildings;
                planetFromPage.LifeformResearch = planetFromApi.LifeformResearch;
            }
            merged.push(planetFromPage);
        }

        return merged;
    }
    private MergeMoons(fromPageData: Moon[] | undefined, fromApi: Moon[] | undefined): Moon[] {
        if (!fromPageData || fromPageData.length === 0) return fromApi ?? [];// If no page data, return API data
        else if (!fromApi || fromApi.length === 0) return fromPageData;// If no API data, return page data

        const apiById = new Map<number, Moon>(fromApi.map(p => [p.Id, p]));

        const merged: Moon[] = [];
        for (const moonFromPage of fromPageData) {
            const moonFromApi = apiById.get(moonFromPage.Id);
            if (moonFromApi) {
                moonFromPage.PlanetId = moonFromApi.PlanetId;
                moonFromPage.Coordinates = moonFromApi.Coordinates;
                moonFromPage.JumpGateLevel = moonFromApi.JumpGateLevel;
                moonFromPage.Resources = moonFromApi.Resources;
                moonFromPage.Production = moonFromApi.Production;
                moonFromPage.Fleet = moonFromApi.Fleet;
                moonFromPage.Defence = moonFromApi.Defence;
                moonFromPage.Buildings = moonFromApi.Buildings;
                moonFromPage.Buffs = moonFromApi.Buffs;
            }
            merged.push(moonFromPage);
        }

        return merged;
    }

    private CreateAccount(extensionSessionData: ExtensionSessionData, extensionLocalData: ExtensionLocalData): Account {



        // Create a new Account object based on the existing local data or initialize it if not present
        const account = new Account(extensionLocalData.Account ?? {});


        if (extensionSessionData.PageData) {
            // Merge Player data
            const player = extensionSessionData.PageData.Player;
            if (player && !player.Class) player.Class = this.apiDataParser.ParsePlayerClass(extensionSessionData.AccountInfo);
            if (player) {
                if (GlobalConstants.VERBOSE_DEBUG_MODE) this.logger.debug(`Player data has changed for universe ${extensionSessionData.UniverseKey}`, DataChanges.FindFirstDifference(account.Player, player));
                account.Player = player;
            }



            // Merge Alliance data
            const alliance = extensionSessionData.PageData.Alliance;
            if (alliance) {
                if (!alliance.Class && extensionSessionData.AccountInfo) alliance.Class = this.apiDataParser.ParseAllianceClass(extensionSessionData.AccountInfo);
                account.Alliance = alliance;
            }

            // Merge Officers data
            const officers = extensionSessionData.PageData.Officers ?? this.apiDataParser.ParseOfficers(extensionSessionData.AccountInfo);
            if (officers) account.Officers = officers;
        }


        if (extensionSessionData.AccountInfo) {
            // Merge Planets data
            const planets = this.SortByCoordinates(this.KeepKnownNames(this.MergePlanets(extensionSessionData.PageData?.Planets, this.apiDataParser.ParsePlanets(extensionSessionData.AccountInfo)), account.Planets));
            if (planets) account.Planets = planets;


            // Merge Moons data
            const moons = this.SortByCoordinates(this.KeepKnownNames(this.MergeMoons(extensionSessionData.PageData?.Moons, this.apiDataParser.ParseMoons(extensionSessionData.AccountInfo)), account.Moons));
            if (moons) account.Moons = moons;


            // Merge Buffs data
            const buffs = this.apiDataParser.ParseAccountBuffs(extensionSessionData.AccountInfo);
            if (buffs) account.Buffs = buffs;



            // Merge Researches data
            const researches = this.apiDataParser.ParseResearches(extensionSessionData.AccountInfo);
            if (researches) account.Researches = researches;

        }

        // Merge LifeformBonuses data if available
        if (extensionSessionData.LifeformBonuses) {
            const lifeformBonuses = this.apiDataParser.ParseLifeformBonuses(extensionSessionData.LifeformBonuses);
            if (lifeformBonuses) account.LifeformBonuses = lifeformBonuses;
        }

        // Calculate and set the CalculatedData based on the merged account data
        const calculatedData = new CalculatedData({
            MaximumExpeditionSlots: dataCalculator.CalculateMaximumExpeditionSlots(account),
            MaximumFleetSlots: dataCalculator.CalculateMaximumFleetSlots(account),
        });
        account.CalculatedData = calculatedData;

        return account;
    }


    public async MergeOgameSessionDataOntoLocalDataAsync(extensionSessionData: ExtensionSessionData): Promise<ExtensionLocalData> {
        const updatedExtensionLocalData = await this.saveManager.UpdateExtensionLocalDataAsync(extensionSessionData.UniverseKey, (extensionLocalData) => {
            this.logger.debug(`Merging session data onto local data for universe ${extensionSessionData.UniverseKey}`, { extensionSessionData, extensionLocalData });

            const account = this.CreateAccount(extensionSessionData, extensionLocalData);
            if (account) extensionLocalData.Account = account;


            const techsLocalizations = this.apiDataParser.ParseTechsLocalizations(extensionSessionData.LifeformBonuses);
            if (techsLocalizations) {
                extensionLocalData.LocalizationData.TechsLocalizations = techsLocalizations;
            }


            return extensionLocalData;
        });

        return updatedExtensionLocalData;

    }
}