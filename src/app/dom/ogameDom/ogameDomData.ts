import { Alliance } from '../../model/alliance';
// import { LifeformType } from '../../model/enums/lifeformType';
// import { FlyingFleetEvent } from '../../model/flyingFleetEvent';
import { Moon } from '../../model/moon';
import { Officers } from '../../model/officers';
import { Planet } from '../../model/planet';
import { Player } from '../../model/player';
// import { Position } from '../../model/position';
// import { QueuedTech } from '../../model/queuedTech';
// import { Resources } from '../../model/resources';


export class OgameDomData {
    OGameVersion?: string;
    PaseDateISO?: string;
    Player?: Player;
    Alliance?: Alliance;
    Officers?: Officers;
    // Position?: Position;
    Planets: Planet[];
    Moons: Moon[];
    // LifeformType?: LifeformType;
    // Resources?: Resources;
    // EnergyProduction?: number;
    // AvailableEnergy?: number;

    // HasLifeforms: boolean;
    // QueuedTechs: QueuedTech[];

    constructor(data: Partial<OgameDomData> = {}) {
        this.OGameVersion = data.OGameVersion;
        this.PaseDateISO = data.PaseDateISO;
        this.Player = data.Player;
        this.Alliance = data.Alliance;
        // this.Officers = data.Officers;
        // this.Position = data.Position;
        this.Planets = data.Planets ?? [];
        this.Moons = data.Moons ?? [];
        // this.LifeformType = data.LifeformType;
        // this.Resources = data.Resources;
        // this.EnergyProduction = data.EnergyProduction;
        // this.AvailableEnergy = data.AvailableEnergy;

        // this.HasLifeforms = data.HasLifeforms ?? false;
        // this.QueuedTechs = data.QueuedTechs ?? [];
    }
}