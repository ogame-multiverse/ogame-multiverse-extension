export class SidePanelGlobalOptions {
  public EventsTimelineVisible: boolean = false;

  constructor(data?: Partial<SidePanelGlobalOptions>) {
    if (data) Object.assign(this, data);
  }
}
