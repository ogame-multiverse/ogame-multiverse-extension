import { PositionType } from './enums/positionType';
import { ImperialProperty } from './imperialProperty';
export class Moon extends ImperialProperty {
  public JumpGateLevel: number;
  constructor(data: Partial<Moon>) {
    super(PositionType.Moon, data);
    this.JumpGateLevel = data.JumpGateLevel || 0;
  }
}

