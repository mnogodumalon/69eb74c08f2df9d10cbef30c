// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Mitarbeiter {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    abteilung?: string;
  };
}

export interface Taetigkeiten {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    taetigkeit_name?: string;
    taetigkeit_beschreibung?: string;
    taetigkeit_kategorie?: LookupValue;
  };
}

export interface Zeiterfassung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    startzeit?: string;
    endzeit?: string;
    dauer_stunden?: number;
    mandant?: LookupValue;
    mitarbeiter_ref?: string; // applookup -> URL zu 'Mitarbeiter' Record
    taetigkeit_ref?: string; // applookup -> URL zu 'Taetigkeiten' Record
    notiz?: string;
  };
}

export const APP_IDS = {
  MITARBEITER: '69eb749bd1b6e71887fae80e',
  TAETIGKEITEN: '69eb74a2c7c186f25a3f3290',
  ZEITERFASSUNG: '69eb74a400a81b8be060f8aa',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'taetigkeiten': {
    taetigkeit_kategorie: [{ key: "beratung", label: "Beratung" }, { key: "buchhaltung", label: "Buchhaltung" }, { key: "steuern", label: "Steuern" }, { key: "verwaltung", label: "Verwaltung" }, { key: "sonstiges", label: "Sonstiges" }],
  },
  'zeiterfassung': {
    mandant: [{ key: "bag", label: "BAG" }, { key: "reichruthhard", label: "ReichRuthhard" }, { key: "juergen_reich", label: "Jürgen Reich" }, { key: "matthias_ruthhard", label: "Matthias Ruthhard" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'mitarbeiter': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'abteilung': 'string/text',
  },
  'taetigkeiten': {
    'taetigkeit_name': 'string/text',
    'taetigkeit_beschreibung': 'string/textarea',
    'taetigkeit_kategorie': 'lookup/select',
  },
  'zeiterfassung': {
    'datum': 'date/date',
    'startzeit': 'string/text',
    'endzeit': 'string/text',
    'dauer_stunden': 'number',
    'mandant': 'lookup/select',
    'mitarbeiter_ref': 'applookup/select',
    'taetigkeit_ref': 'applookup/select',
    'notiz': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateMitarbeiter = StripLookup<Mitarbeiter['fields']>;
export type CreateTaetigkeiten = StripLookup<Taetigkeiten['fields']>;
export type CreateZeiterfassung = StripLookup<Zeiterfassung['fields']>;