export class WarriorClassBonus {
  public combatShipSpeed: string | number;
  public recyclerSpeed: string | number;
  public recyclerCargo: string | number;
  public fuelConsumption: string | number;
  public combatResearch: number;
  public fleetSlots: number;
  public moonFields: number;

  constructor(data: Partial<WarriorClassBonus> = {}) {
    this.combatShipSpeed = data.combatShipSpeed ?? 0;
    this.recyclerSpeed = data.recyclerSpeed ?? 0;
    this.recyclerCargo = data.recyclerCargo ?? 0;
    this.fuelConsumption = data.fuelConsumption ?? 0;
    this.combatResearch = data.combatResearch ?? 0;
    this.fleetSlots = data.fleetSlots ?? 0;
    this.moonFields = data.moonFields ?? 0;
  }
}