export class Officers {
  public Commander: boolean;
  public Engineer: boolean;
  public Admiral: boolean;
  public Geologist: boolean;
  public Technocrat: boolean;
  public All: boolean;
  constructor(data: Partial<Officers>) {
    this.Commander = data.Commander || false;
    this.Engineer = data.Engineer || false;
    this.Admiral = data.Admiral || false;
    this.Geologist = data.Geologist || false;
    this.Technocrat = data.Technocrat || false;
    this.All = this.Commander && this.Engineer && this.Admiral && this.Geologist && this.Technocrat;
  }
}

