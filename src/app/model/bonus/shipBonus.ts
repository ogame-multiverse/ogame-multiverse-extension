export class ShipBonus {
  public Armor: number;
  public Shield: number;
  public Weapon: number;
  public Speed: number;
  public Cargo: number;
  public Fuel: number;

  constructor(data: Partial<ShipBonus> = {}) {
    this.Armor = data.Armor ?? 0;
    this.Shield = data.Shield ?? 0;
    this.Weapon = data.Weapon ?? 0;
    this.Speed = data.Speed ?? 0;
    this.Cargo = data.Cargo ?? 0;
    this.Fuel = data.Fuel ?? 0;
  }
}