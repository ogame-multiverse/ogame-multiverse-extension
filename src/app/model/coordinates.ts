export class Coordinates {
  public readonly IsOwn: boolean;
  public readonly Galaxy: number;
  public readonly System: number;
  public readonly Position: number;
  public readonly Full: string;

  constructor(isOwn: boolean, coordinates?: string) {
    this.IsOwn = isOwn;
    const parsed = Coordinates.Parse(coordinates);
    this.Full = parsed.full;
    this.Galaxy = parsed.galaxy;
    this.System = parsed.system;
    this.Position = parsed.position;
  }

  public static Normalize(coordinates?: string): string {
    if (!coordinates) return '0:0:0';
    return coordinates.replace(/\[|\]/g, '').trim();
  }

  public static AreSame(coord1: Partial<Coordinates>, coord2: Partial<Coordinates>): boolean {
    if (!coord1 || !coord2) return false;
    if (coord1.Full && coord2.Full && coord1.Full === coord2.Full) return true;
    if (!coord1.Galaxy || !coord1.System || !coord1.Position) return false;
    if (!coord2.Galaxy || !coord2.System || !coord2.Position) return false;
    return coord1.Galaxy === coord2.Galaxy && coord1.System === coord2.System && coord1.Position === coord2.Position;
  }

  public static Parse(coordinates?: string): { full: string; galaxy: number; system: number; position: number } {
    const fullNormalized = this.Normalize(coordinates);
    const splits = fullNormalized.split(':');
    return {
      full: fullNormalized,
      galaxy: parseInt(splits[0] || '0'),
      system: parseInt(splits[1] || '0'),
      position: parseInt(splits[2] || '0'),
    };
  }
}

