import { Coordinates } from "./coordinates";
import { PositionType } from "./enums/positionType";

export class Position {
  public readonly Id: number | undefined;
  public readonly Name: string | undefined;
  public readonly Coordinates: Coordinates;
  public readonly Type: PositionType | undefined;

  constructor(data: Partial<Position>) {
    this.Id = data.Id;
    this.Name = data.Name;
    this.Coordinates = data.Coordinates ?? new Coordinates(false, "");
    this.Type = data.Type;
  }

  public static AreSame(pos1: Position, pos2: Position): boolean {
    if (!pos1 || !pos2) return false;

    if (pos1.Id !== undefined && pos2.Id !== undefined && pos1.Id === pos2.Id) {
      return true;
    }

    if (
      pos1.Coordinates !== undefined &&
      pos2.Coordinates !== undefined &&
      pos1.Type !== undefined &&
      pos2.Type !== undefined
    ) {
      return Coordinates.AreSame(pos1.Coordinates, pos2.Coordinates) && pos1.Type === pos2.Type;
    }

    return false;
  }
}

