import { ResourceType } from './enums/resourceType';

export class Resources {
    public Metal: number = 0;
    public Crystal: number = 0;
    public Deuterium: number = 0;
    public Energy: number = 0;

    constructor(data: Partial<Resources>) {
        this.Metal = data.Metal || 0;
        this.Crystal = data.Crystal || 0;
        this.Deuterium = data.Deuterium || 0;
        this.Energy = data.Energy || 0;
    }

    public static Empty: Resources = new Resources({ Metal: 0, Crystal: 0, Deuterium: 0 });

    public static GetValue(resourceType: ResourceType, resource: Resources): number {
        switch (resourceType) {
            case ResourceType.Metal:
                return resource.Metal;
            case ResourceType.Crystal:
                return resource.Crystal;
            case ResourceType.Deuterium:
                return resource.Deuterium;
            case ResourceType.Energy:
                return resource.Energy;
            default:
                return 0;
        }
    }
    public static GetTotal(resources: Resources | undefined): number;
    public static GetTotal(resources: Resources[] | undefined): number;
    public static GetTotal(resources: Resources | Resources[] | undefined): number {
        if (!resources) return 0;

        const list = Array.isArray(resources) ? resources : [resources];

        return list.reduce((total, res) => {
            return total + (res?.Metal ?? 0) + (res?.Crystal ?? 0) + (res?.Deuterium ?? 0);
        }, 0);
    }
}

