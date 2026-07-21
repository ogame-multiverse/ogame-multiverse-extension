import { UniverseSidePanelOptions } from '../sidePanel/universeSidePanelOptions';
export class ExtensionLocalData {

  public UniverseKey: string;
  public UniverseName: string;
  public UniverseNumber: number;
  public UniverseLanguage: string;
  public UniverseDomain: string;

  public LastRefreshDate?: number;

  public SidePanelOptions: UniverseSidePanelOptions;

  constructor(data: Partial<ExtensionLocalData>) {
    this.UniverseKey = data.UniverseKey;
    this.UniverseName = data.UniverseName;
    this.UniverseNumber = data.UniverseNumber;
    this.UniverseDomain = data.UniverseDomain;

    this.LastRefreshDate = data.LastRefreshDate;

    this.SidePanelOptions = new UniverseSidePanelOptions(data.SidePanelOptions || {});
  }
}