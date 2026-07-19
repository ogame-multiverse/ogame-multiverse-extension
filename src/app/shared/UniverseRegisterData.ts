export class UniverseRegisterData {

  public UniverseKey: string;
  public UniverseName: string;
  public UniverseDomain: string;

  public LastRefreshDate?: number;

  constructor(data: Partial<UniverseRegisterData>) {
    this.UniverseKey = data.UniverseKey;
    this.UniverseName = data.UniverseName;
    this.UniverseDomain = data.UniverseDomain;

    this.LastRefreshDate = data.LastRefreshDate;
  }
}