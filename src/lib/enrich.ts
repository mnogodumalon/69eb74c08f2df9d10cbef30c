import type { EnrichedZeiterfassung } from '@/types/enriched';
import type { Mitarbeiter, Taetigkeiten, Zeiterfassung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface ZeiterfassungMaps {
  mitarbeiterMap: Map<string, Mitarbeiter>;
  taetigkeitenMap: Map<string, Taetigkeiten>;
}

export function enrichZeiterfassung(
  zeiterfassung: Zeiterfassung[],
  maps: ZeiterfassungMaps
): EnrichedZeiterfassung[] {
  return zeiterfassung.map(r => ({
    ...r,
    mitarbeiter_refName: resolveDisplay(r.fields.mitarbeiter_ref, maps.mitarbeiterMap, 'vorname', 'nachname'),
    taetigkeit_refName: resolveDisplay(r.fields.taetigkeit_ref, maps.taetigkeitenMap, 'taetigkeit_name'),
  }));
}
