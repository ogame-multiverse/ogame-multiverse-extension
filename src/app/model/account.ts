import { Alliance } from './alliance';
import { LifeformBonuses } from './bonus/lifeformBonuses';
import { Buff } from './buff';
import { CalculatedData } from './calculatedData';
import { ResearchType } from './enums/techTypes';
import { Moon } from './moon';
import { Officers } from './officers';
import { Planet } from './planet';
import { Player } from './player';
export class Account {

    public Player: Player;
    public Alliance: Alliance | undefined;
    public Planets: Planet[];
    public Moons: Moon[];
    public Researches: Record<ResearchType, number>;
    public Officers: Officers;
    public LifeformBonuses: LifeformBonuses | undefined;
    public Buffs: Buff[];
    public CalculatedData: CalculatedData;
    constructor(data: Partial<Account>) {

        this.Player = new Player(data.Player ?? {});
        this.Alliance = data.Alliance ? new Alliance(data.Alliance) : undefined;
        this.Planets = data.Planets ?? [];
        this.Moons = data.Moons ?? [];
        this.Researches = ((data.Researches ?? {}) as Record<ResearchType, number>);
        this.Officers = new Officers(data.Officers ?? {});
        this.LifeformBonuses = data.LifeformBonuses;
        this.Buffs = data.Buffs || [];
        this.CalculatedData = new CalculatedData(data.CalculatedData ?? {});
    }

}