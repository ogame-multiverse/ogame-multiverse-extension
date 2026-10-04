export class DataChanges {
    public static readonly None: unique symbol = Symbol('NO_CHANGES');

    public static FindFirstDifference(a: unknown, b: unknown, path = ''): string | undefined {
        if (a === b) return undefined;
        if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
            return `${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
        }
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
            const diff = DataChanges.FindFirstDifference((a as any)[key], (b as any)[key], `${path}.${key}`);
            if (diff) return diff;
        }
        return undefined;
    }

    public static ObjectHasChanges(a: unknown, b: unknown): boolean {
        return !DataChanges.DeepEqual(a, b);
    }

    private static DeepEqual(a: unknown, b: unknown): boolean {
        if (a === b) return true;
        if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
            return a !== a && b !== b; // NaN
        }

        const aIsArray = Array.isArray(a);
        if (aIsArray !== Array.isArray(b)) return false;

        if (aIsArray) {
            const arrA = a as unknown[];
            const arrB = b as unknown[];
            if (arrA.length !== arrB.length) return false;
            for (let i = 0; i < arrA.length; i++) {
                if (!DataChanges.DeepEqual(arrA[i], arrB[i])) return false;
            }
            return true;
        }

        const objA = a as Record<string, unknown>;
        const objB = b as Record<string, unknown>;
        const hasOwn = Object.prototype.hasOwnProperty;

        let countA = 0;
        for (const key in objA) {
            if (!hasOwn.call(objA, key)) continue;
            const valueA = objA[key];
            if (valueA === undefined) continue;
            countA++;
            if (!DataChanges.DeepEqual(valueA, objB[key])) return false;
        }

        let countB = 0;
        for (const key in objB) {
            if (hasOwn.call(objB, key) && objB[key] !== undefined) countB++;
        }
        return countA === countB;
    }
}

export type DataMutator<T> = (data: T) => T | typeof DataChanges.None | Promise<T | typeof DataChanges.None>;