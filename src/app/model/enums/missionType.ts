export enum MissionType {
    Unknown = -99,
    Attack = 1,
    AcsAttack = 2,
    Transport = 3,
    Deployment = 4,
    AcsDefend = 5,
    Spy = 6,
    Colonisation = 7,
    Harvest = 8,
    MoonDestruction = 9,
    MissileAttack = 10,
    AcsAnomalyEncounter = 13,
    AnomalyEncounter = 14,
    Expedition = 15,
    Exploration = 18,
    AnomalyRewardDelivery = 20,
}

export const ExpeditionMissions: MissionType[] = [MissionType.Expedition];
export const TransportMissions: MissionType[] = [MissionType.Transport, MissionType.Deployment];
export const CombatMissions: MissionType[] = [MissionType.Attack, MissionType.AcsAttack, MissionType.Spy, MissionType.MoonDestruction, MissionType.MissileAttack, MissionType.AcsDefend];
export const OtherMissions: MissionType[] = [MissionType.Colonisation, MissionType.Exploration, MissionType.Harvest];

export enum MissionCategory {
    Combat = 'combat',
    Transport = 'transport',
    Expedition = 'expedition',
    Other = 'other',
}

export function GetMissionCategory(missionType: MissionType): MissionCategory {
    if (CombatMissions.includes(missionType)) {
        return MissionCategory.Combat;
    } else if (TransportMissions.includes(missionType)) {
        return MissionCategory.Transport;
    } else if (ExpeditionMissions.includes(missionType)) {
        return MissionCategory.Expedition;
    } else {
        return MissionCategory.Other;
    }
}

