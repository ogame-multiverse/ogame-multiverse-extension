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

    public CalculateMaximumFleetSlots(account: Account): number {
        const computerLevel = account.Researches?.[ResearchType.Computer] ?? 0;
        const playerClass = account.Player?.Class;

        // Base slots from Computer level (1 slot + 1 additional slot per level of Computer research)
        const baseSlots = 1 + Math.max(0, computerLevel);

        // Warrior class bonus (default 2 slots, can be increased by LifeformBonuses)
        const classBonus = playerClass === PlayerClass.Warrior
            ? (account.LifeformBonuses?.classBonus?.Warrior?.fleetSlots ?? 2)
            : 0;

        // Admiral officer bonus (2 slot if present)
        const admiralBonus = account.Officers?.Admiral ? 2 : 0;

        // All officers bonus (1 slot if present)
        const allOfficersBonus = account.Officers?.All ? 1 : 0;

        // Buffs that provide additional fleet slots
        const buffBonus = (account.Buffs ?? [])
            .reduce((sum, buff) => buff.Type === BuffType.FleetSlot ? sum + (buff.Bonus ?? 0) : sum, 0);

        return baseSlots + classBonus + admiralBonus + allOfficersBonus + buffBonus;
    }

}
export const dataCalculator = new DataCalculator();