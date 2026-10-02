export class ExpeditionBonus {
  public ShipResultBooster: number;
  public DMBooster: number;
  public EnemyReducer: number;
  public FleetLostReducer: number;
  public ResultBooster: number;
  public SpeedBooster: number;

  constructor(data: Partial<ExpeditionBonus> = {}) {
    this.ShipResultBooster = data.ShipResultBooster ?? 0;
    this.DMBooster = data.DMBooster ?? 0;
    this.EnemyReducer = data.EnemyReducer ?? 0;
    this.FleetLostReducer = data.FleetLostReducer ?? 0;
    this.ResultBooster = data.ResultBooster ?? 0;
    this.SpeedBooster = data.SpeedBooster ?? 0;
  }
}