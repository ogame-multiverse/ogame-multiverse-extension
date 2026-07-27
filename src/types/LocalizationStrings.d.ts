// Déclarations pour l'objet global injecté par OGame
// Fournit une forme minimale des clés utilisées dans le code du projet.

export interface LocalizationStrings {
  // séparateurs numériques
  thousandSeperator: string;
  decimalPoint: string;

  // unités (k, M, G etc.)
  unitKilo: string;
  unitMega: string;
  unitMilliard: string;

  // messages courants
  loading?: string;
  attention?: string;
  redirectMessage?: string;
  yes?: string;
  no?: string;
  ok?: string;

  // états / statuts
  status?: Record<string, string> | undefined;

  // timeunits: souvent utilisé comme LocalizationStrings.timeunits.short.day etc.
  timeunits?: {
    short?: Record<string, string>;
    long?: Record<string, string>;
  };

  // Permettre d'autres clés dynamiques (fallback)
  [key: string]: any;
}

export {};

