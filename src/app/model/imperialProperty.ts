import { Coordinates } from './coordinates';
import { BuildingType, ShipType, DefenceType } from './enums/techTypes';
import { Production } from './production';
import { Resources } from './resources';
import { ResourcesStorage } from './resourcesStorage';
import { PositionType } from './enums/positionType';
import { Tech } from './tech';
import { Buff } from './buff';

export class ImperialProperty {
    public Id: number;
    public PlanetId: number;
    public Name: string;
    public Coordinates: Coordinates;
    public Type: PositionType;
    public MinTemperature: number | undefined;
    public MaxTemperature: number | undefined;
    public Diameter: number | undefined;
    public FieldMax: number | undefined;
    public FieldUsed: number | undefined;

    public Resources: Resources;
    public Storage: ResourcesStorage;
    public Production: Production;

    public Fleet: Record<ShipType, number>;
    public Defence: Record<DefenceType, number>;
    public Buildings: Record<BuildingType, number>;

    public Buffs: Buff[];

    public BackgroundImageUrl: string | undefined;

    constructor(positionType: PositionType, data: Partial<ImperialProperty>) {
        this.Id = data.Id || 0;
        this.PlanetId = data.PlanetId || 0;
        this.Name = data.Name || '';
        this.Coordinates = data.Coordinates || new Coordinates(false, '');
        this.Type = positionType;
        this.FieldMax = data.FieldMax;
        this.FieldUsed = data.FieldUsed;
        this.MinTemperature = data.MinTemperature;
        this.MaxTemperature = data.MaxTemperature;
        this.Diameter = data.Diameter;
        this.Resources = data.Resources || new Resources({});
        this.Storage = data.Storage || new ResourcesStorage({});
        this.Production = data.Production || new Production({});
        this.Fleet = data.Fleet || Tech.DefaultFleet();
        this.Defence = data.Defence || Tech.DefaultDefence();
        this.Buildings = (data.Buildings as Record<BuildingType, number>) || ({} as Record<BuildingType, number>);
        this.Buffs = data.Buffs || [];
        this.BackgroundImageUrl = data.BackgroundImageUrl;
    }
}

