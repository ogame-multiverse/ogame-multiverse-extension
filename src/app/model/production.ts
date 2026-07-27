import { Resources } from './resources';

export class Production {
  public static NoProduction: Production = new Production({
    Hourly: new Resources({}),
    Daily: new Resources({}),
    Weekly: new Resources({}),
  });

  public Hourly: Resources;
  public Daily: Resources;
  public Weekly: Resources;
  constructor(data: Partial<Production>) {
    this.Hourly = data.Hourly || new Resources({});
    this.Daily = data.Daily || new Resources({});
    this.Weekly = data.Weekly || new Resources({});
  }
}

