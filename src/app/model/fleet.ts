import type { ShipType } from './enums/techTypes';

export class Fleet {
  public Id: number | undefined;
  public Ships: Record<ShipType, number>;

  constructor(data: Partial<Fleet>) {
    this.Id = data.Id;
    this.Ships = data.Ships ?? ({} as Record<ShipType, number>);
  }

  /**
   * Counts the total number of ships in the fleet.
   * @param fleet
   * @returns
   */
  public static Count(fleet: Fleet | undefined): number {
    if (!fleet) return 0;
    return Object.values(fleet.Ships).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Checks if the fleet is only composed of a specific ship type.
   * @param fleet
   * @param shipType
   * @returns
   */
  public static IsOnlyComposedOf(fleet: Fleet | undefined, shipType: ShipType): boolean {
    if (!fleet) return false;
    const targetCount = fleet.Ships[shipType] ?? 0;
    return targetCount > 0 && targetCount === Fleet.Count(fleet);
  }
}

