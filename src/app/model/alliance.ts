import { AllianceClass } from './enums/allianceClass';
export class Alliance {
  public Id: number;
  public Name?: string;
  public Tag?: string;
  public Class?: AllianceClass;
  constructor(data: Partial<Alliance>) {
    this.Id = data.Id || 0;
    this.Name = data.Name;
    this.Tag = data.Tag;
    this.Class = data.Class ?? AllianceClass.Unknown;
  }
}

