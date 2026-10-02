import { DateUtils } from '../dateUtils';
import { TechGroup } from './techGroup';

export class QueuedTech {
  public PositionId: number | undefined;
  public TechGroup: TechGroup | undefined;
  public TechId: number | undefined;
  public TechName: string | undefined;
  public FromLevel: number | undefined;
  public ToLevel: number | undefined;
  public EndDate: string | undefined;
  constructor(data: Partial<QueuedTech>) {
    this.PositionId = data.PositionId;
    this.TechId = data.TechId;
    this.FromLevel = data.FromLevel;
    this.ToLevel = data.ToLevel;
    this.TechGroup = data.TechGroup;
    this.TechName = data.TechName;
    this.EndDate = data.EndDate;
  }

  /**
   * Returns the queueed techs for the specified imperial property and tech groups.
   * @param queedTechs The list of all queueed techs.
   * @param positionId The imperial property id to filter by.
   * @param techGroups The tech groups to filter by.
   * @returns The filtered list of queueed techs.
   */
  public static GetImperialPropertyQueuedTechs(queedTechs: QueuedTech[], positionId: number, techGroups: TechGroup[]): QueuedTech[] {
    if (!queedTechs || queedTechs.length === 0) return [];
    return queedTechs.filter((t) => t.PositionId === positionId && t.TechGroup && techGroups.includes(t.TechGroup) && (!t.EndDate || !DateUtils.DateIsObsolete(t.EndDate, -100))); // 100ms margin to avoid removing techs that just ended
  }
}

