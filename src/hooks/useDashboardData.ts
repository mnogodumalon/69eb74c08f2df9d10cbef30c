import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Mitarbeiter, Taetigkeiten, Zeiterfassung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [taetigkeiten, setTaetigkeiten] = useState<Taetigkeiten[]>([]);
  const [zeiterfassung, setZeiterfassung] = useState<Zeiterfassung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [mitarbeiterData, taetigkeitenData, zeiterfassungData] = await Promise.all([
        LivingAppsService.getMitarbeiter(),
        LivingAppsService.getTaetigkeiten(),
        LivingAppsService.getZeiterfassung(),
      ]);
      setMitarbeiter(mitarbeiterData);
      setTaetigkeiten(taetigkeitenData);
      setZeiterfassung(zeiterfassungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [mitarbeiterData, taetigkeitenData, zeiterfassungData] = await Promise.all([
          LivingAppsService.getMitarbeiter(),
          LivingAppsService.getTaetigkeiten(),
          LivingAppsService.getZeiterfassung(),
        ]);
        setMitarbeiter(mitarbeiterData);
        setTaetigkeiten(taetigkeitenData);
        setZeiterfassung(zeiterfassungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const mitarbeiterMap = useMemo(() => {
    const m = new Map<string, Mitarbeiter>();
    mitarbeiter.forEach(r => m.set(r.record_id, r));
    return m;
  }, [mitarbeiter]);

  const taetigkeitenMap = useMemo(() => {
    const m = new Map<string, Taetigkeiten>();
    taetigkeiten.forEach(r => m.set(r.record_id, r));
    return m;
  }, [taetigkeiten]);

  return { mitarbeiter, setMitarbeiter, taetigkeiten, setTaetigkeiten, zeiterfassung, setZeiterfassung, loading, error, fetchAll, mitarbeiterMap, taetigkeitenMap };
}