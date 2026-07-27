import { ResourceType } from './enums/resourceType.ts';
import { Production } from './production.ts';
import { Resources } from './resources.ts';

export class ResourcesStorage extends Resources {
  public static InfiniteStorage: ResourcesStorage = new ResourcesStorage({
    Metal: Infinity,
    Crystal: Infinity,
    Deuterium: Infinity,
  });
  constructor(data: Partial<ResourcesStorage>) {
    super(data);
  }

  /**
   * Get the percentage of a specific resource in storage.
   * @param resourceType The type of resource.
   * @param storage The storage object.
   * @returns The percentage of the resource in storage.
   */
  public static GetPercentageFull(resourceType: ResourceType, storage: ResourcesStorage, resources: Resources): number {
    const capacity = ResourcesStorage.GetValue(resourceType, storage);
    const amount = Resources.GetValue(resourceType, resources);

    if (capacity <= 0) return 0;

    return Math.min(100, Math.round((amount / capacity) * 100 * 100) / 100);
  }

  /**
   * Check if the storage is full.
   * @param resourceType The type of resource.
   * @param storage The storage object.
   * @param resources The resources object.
   * @returns True if the storage is full, false otherwise.
   */
  public static IsFull(resourceType: ResourceType, storage: ResourcesStorage, resources: Resources): boolean {
    const capacity = ResourcesStorage.GetValue(resourceType, storage);
    const amount = Resources.GetValue(resourceType, resources);
    return amount >= capacity;
  }

  public static MinutesToFull(resourceType: ResourceType, storage: ResourcesStorage, resources: Resources, production: Production): number {
    const capacity = ResourcesStorage.GetValue(resourceType, storage);
    const amount = Resources.GetValue(resourceType, resources);

    // Already full
    if (amount >= capacity) {
      return 0;
    }

    const hourlyProduction = Resources.GetValue(resourceType, production.Hourly);

    // No production (will never be full)
    if (hourlyProduction <= 0) {
      return Infinity;
    }

    // Calculate minutes to full
    return ((capacity - amount) / hourlyProduction) * 60;
  }

  /**
   * Check if the resource is nearly full (based on percentage or production in next hours).
   * @param resourceType The type of resource.
   * @param storage The storage object.
   * @param resources The resources object.
   * @param production The production object.
   * @param hoursThreshold Hours threshold to consider nearly full based on production (default: 2).
   * @param percentageThreshold Percentage threshold to consider nearly full.
   * @returns True if the resource is nearly full, false otherwise.
   */
  public static IsNearlyFull(
    resourceType: ResourceType,
    storage: ResourcesStorage,
    resources: Resources,
    production: Production,
    hoursThreshold: number = 2,
    percentageThreshold: number = 90
  ): boolean {
    if (percentageThreshold > 0) {
      const percentage = ResourcesStorage.GetPercentageFull(resourceType, storage, resources);
      if (percentage >= percentageThreshold) {
        return true;
      }
    }

    if (hoursThreshold > 0) {
      const minutesToFull = ResourcesStorage.MinutesToFull(resourceType, storage, resources, production);
      if (minutesToFull <= hoursThreshold * 60) {
        return true;
      }
    }

    return false;
  }
}

