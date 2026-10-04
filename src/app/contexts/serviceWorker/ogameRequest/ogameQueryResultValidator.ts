import type { OgameQueryResult } from "./ogameQueryResult";

export class OgameQueryResultValidator {

    public static HasAnyDataFetched(result: OgameQueryResult): boolean {
        return result.AccountInfoFetched || result.LifeformBonusesFetched || result.TechQuantitiesFetched || result.ImportExportFetched;
    }

    public static IsAccountInfoValid(result: OgameQueryResult): boolean {
        return this.IsObjectWithProperties(result?.AccountInfo, ['playerId', 'playerName', 'planets', 'researches', 'spaceObjects', 'species']);
    }

    public static IsLifeformBonusesValid(result: OgameQueryResult): boolean {
        return this.IsObjectWithProperties(result?.LifeformBonuses, [
            'data.characterclasses',
            'data.costreduction',
            'data.defenses',
            'data.expedition',
            'data.misc',
            'data.resources',
            'data.ships',
            'static.technologies',
        ]);
    }

    private static IsObjectWithProperties(obj: any, properties: string[]): boolean {
        return properties.every(path => this.HasPath(obj, path.split('.')));
    }

    private static HasPath(obj: any, keys: string[]): boolean {
        if (keys.length === 0) {
            return true;
        }
        if (obj === null || typeof obj !== 'object') {
            return false;
        }
        const [key, ...rest] = keys;
        return Object.prototype.hasOwnProperty.call(obj, key) && this.HasPath(obj[key], rest);
    }
}