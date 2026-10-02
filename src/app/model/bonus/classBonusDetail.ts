export class ClassBonusDetail {
  public name: string;
  public nameKey: string;
  public withBonus: string;
  public withBonusValue: string | number;
  public withoutBonus: string;
  public withoutBonusValue: string | number;

  constructor(data: Partial<ClassBonusDetail> = {}) {
    this.name = data.name ?? "";
    this.nameKey = data.nameKey ?? "";
    this.withBonus = data.withBonus ?? "";
    this.withBonusValue = data.withBonusValue ?? "";
    this.withoutBonus = data.withoutBonus ?? "";
    this.withoutBonusValue = data.withoutBonusValue ?? "";
  }
}