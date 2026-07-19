// Base générique pour singletons (une instance par sous‑classe).
export abstract class OgmSingleton {
  protected constructor() { }
  private static _instances = new Map<Function, any>();

  // Getter
  public static GetInstance<T>(this: new () => T): T {
    let inst = OgmSingleton._instances.get(this);
    if (!inst) {
      inst = new this();
      OgmSingleton._instances.set(this, inst);
    }
    return inst as T;
  }

  // Setter (remplace l’instance existante)
  public static SetInstance<T>(this: new () => T, value: T) {
    OgmSingleton._instances.set(this, value);
  }

  // Facultatif: reset pour forcer recréation au prochain get
  public static Reset(this: Function): void {
    OgmSingleton._instances.delete(this);
  }
}

