export class UniverseLayoutConfig {
  favoriteListOrder: string[];
  favoriteGridOrder: string[][];
  listOrder: string[];
  gridOrder: string[][];

  constructor(data?: Partial<UniverseLayoutConfig>) {
    this.favoriteListOrder = data?.favoriteListOrder ? [...data.favoriteListOrder] : [];
    this.favoriteGridOrder = data?.favoriteGridOrder ? data.favoriteGridOrder.map((col) => [...col]) : [];
    this.listOrder = data?.listOrder ? [...data.listOrder] : [];
    this.gridOrder = data?.gridOrder ? data.gridOrder.map((col) => [...col]) : [];
  }
}