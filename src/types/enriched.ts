import type { Zeiterfassung } from './app';

export type EnrichedZeiterfassung = Zeiterfassung & {
  mitarbeiter_refName: string;
  taetigkeit_refName: string;
};
