export class TechnologyBonus {
  [techId: number]: number | 0;
  constructor(data: Partial<TechnologyBonus>) {
    Object.assign(this, data);
  }
}

