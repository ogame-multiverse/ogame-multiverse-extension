import { Fleet } from './fleet';
import { Resources } from './resources';
import { Position } from './position';
import { MissionType } from './enums/missionType';

export class FlyingFleetEvent {
  public readonly Id: number;
  public readonly IsReturn: boolean;
  public readonly IsOwnFleet: boolean;
  public readonly MissionType: MissionType;
  public readonly ArrivalTime?: number;
  public readonly Origin: Position;
  public readonly Destination: Position;
  public readonly FleetCount?: number;
  public readonly IsGhost: boolean;
  public RelatedId?: number; // if this is going, id of return event, or if return, id of go event
  public Fleet?: Fleet;
  public Cargo?: Resources;
  constructor(data: Partial<FlyingFleetEvent>) {
    this.Id = data.Id ?? 0;
    this.IsReturn = data.IsReturn ?? false;
    this.IsOwnFleet = data.IsOwnFleet ?? false;
    this.MissionType = data.MissionType ?? MissionType.Unknown;
    this.ArrivalTime = data.ArrivalTime;
    this.Origin = data.Origin ?? new Position({});
    this.Destination = data.Destination ?? new Position({});
    this.FleetCount = data.FleetCount;
    this.IsGhost = data.IsGhost ?? false;
    this.RelatedId = data.RelatedId;
    this.Fleet = data.Fleet;
    this.Cargo = data.Cargo;
  }
}