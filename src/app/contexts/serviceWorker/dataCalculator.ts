import { Account } from "../../model/account";
import { BuffType } from "../../model/buff";
import { PlayerClass } from "../../model/enums/playerClass";
import { ResearchType } from "../../model/enums/techTypes";

class DataCalculator {

    public CalculateMaximumExpeditionSlots(account: Account): number {
        const astrophysicsLevel = account.Researches?.[ResearchType.Astrophysics] ?? 0;
        const playerClass = account.Player?.Class;

        // Base slots from Astrophysics level
        const baseSlots = Math.floor(Math.sqrt(Math.max(0, astrophysicsLevel)));

        // Explorer class bonus (default 2 slots, can be increased by LifeformBonuses)
        const classBonus = playerClass === PlayerClass.Explorer
            ? (account.LifeformBonuses?.classBonus?.Explorer?.expeditionSlots ?? 2)
            : 0;

        // Admiral officer bonus (1 slot if present)
        const admiralBonus = account.Officers?.Admiral ? 1 : 0;

        // Buffs that provide additional expedition slots
        const buffBonus = (account.Buffs ?? [])
            .reduce((sum, buff) => buff.Type === BuffType.ExpeditionSLot ? sum + (buff.Bonus ?? 0) : sum, 0);

        return baseSlots + classBonus + admiralBonus + buffBonus;
    }

}
export const dataCalculator = new DataCalculator();