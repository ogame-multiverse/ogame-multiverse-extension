import { PlayerClass } from './enums/playerClass';

export class Player {
    public Id: number;
    public Name: string | undefined;
    public Status: string | undefined;
    public AllianceId: number | undefined;
    public Class: PlayerClass;

    public Color: string | undefined;
    public Icon: string | undefined;

    constructor(data: Partial<Player>) {
        this.Id = data.Id ?? 0;
        this.Status = data.Status;
        this.Name = data.Name
        this.AllianceId = data.AllianceId;
        this.Class = data.Class ?? PlayerClass.Unknown;
        this.Color = data.Color;
        this.Icon = data.Icon;
    }

    public static Merge(oldData: Player | undefined, newData: Player | undefined): Player | undefined {
        if (!oldData && !newData) return undefined;
        else if (!oldData && newData) return new Player(newData);
        else if (oldData && !newData) return oldData;
        else {
            return new Player({
                Id: newData!.Id ?? oldData!.Id,
                Status: newData!.Status ?? oldData!.Status,
                Name: newData!.Name ?? oldData!.Name,
                AllianceId: newData!.AllianceId ?? oldData!.AllianceId,
                Class: newData!.Class ?? oldData!.Class,
                Color: newData!.Color ?? oldData!.Color,
                Icon: newData!.Icon ?? oldData!.Icon,
            });
        }
    }
}

