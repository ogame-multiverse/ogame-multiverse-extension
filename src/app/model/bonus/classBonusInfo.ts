import { ClassBonusDetail } from './classBonusDetail';
export class ClassBonusInfo {
    public Details: ClassBonusDetail[];
    public TotalBonus: number;

    constructor(data: Partial<ClassBonusInfo> = {}) {
        this.Details = data.Details ?? [];
        this.TotalBonus = data.TotalBonus ?? 0;
    }
}