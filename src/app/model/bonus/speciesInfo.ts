export class SpeciesInfo {
  public Level: number;
  public Xp: number;
  public XpToNextLevel: number;
  public Bonus: number;

  constructor(data: Partial<SpeciesInfo> = {}) {
    this.Level = data.Level ?? 0;
    this.Xp = data.Xp ?? 0;
    this.XpToNextLevel = data.XpToNextLevel ?? 0;
    this.Bonus = data.Bonus ?? 0;
  }
}