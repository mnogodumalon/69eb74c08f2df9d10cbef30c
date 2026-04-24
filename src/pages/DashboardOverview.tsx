import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichZeiterfassung } from '@/lib/enrich';
import type { EnrichedZeiterfassung } from '@/types/enriched';
import type { Zeiterfassung } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconPlus, IconPencil, IconTrash, IconClock, IconUsers, IconChevronLeft, IconChevronRight, IconCalendar, IconBriefcase } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ZeiterfassungDialog } from '@/components/dialogs/ZeiterfassungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, isSameDay, parseISO, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';

const APPGROUP_ID = '69eb74c08f2df9d10cbef30c';
const REPAIR_ENDPOINT = '/claude/build/repair';

const MANDANT_COLORS: Record<string, string> = {
  bag: 'bg-blue-100 text-blue-700 border-blue-200',
  reichruthhard: 'bg-purple-100 text-purple-700 border-purple-200',
  juergen_reich: 'bg-amber-100 text-amber-700 border-amber-200',
  matthias_ruthhard: 'bg-green-100 text-green-700 border-green-200',
};

export default function DashboardOverview() {
  const {
    mitarbeiter, taetigkeiten, zeiterfassung,
    mitarbeiterMap, taetigkeitenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedZeiterfassung = enrichZeiterfassung(zeiterfassung, { mitarbeiterMap, taetigkeitenMap });

  // All hooks before early returns
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [selectedMitarbeiter, setSelectedMitarbeiter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<EnrichedZeiterfassung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined);

  const weekStart = useMemo(() => startOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);
  const weekEnd = useMemo(() => endOfWeek(currentWeek, { weekStartsOn: 1 }), [currentWeek]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const filteredEntries = useMemo(() => {
    return enrichedZeiterfassung.filter(e => {
      if (!e.fields.datum) return false;
      try {
        const d = parseISO(e.fields.datum);
        if (!isWithinInterval(d, { start: weekStart, end: weekEnd })) return false;
      } catch { return false; }
      if (selectedMitarbeiter !== 'all') {
        const id = extractRecordId(e.fields.mitarbeiter_ref);
        if (id !== selectedMitarbeiter) return false;
      }
      return true;
    });
  }, [enrichedZeiterfassung, weekStart, weekEnd, selectedMitarbeiter]);

  const totalHoursThisWeek = useMemo(() =>
    filteredEntries.reduce((s, e) => s + (e.fields.dauer_stunden ?? 0), 0),
    [filteredEntries]
  );

  const totalHoursAll = useMemo(() =>
    zeiterfassung.reduce((s, e) => s + (e.fields.dauer_stunden ?? 0), 0),
    [zeiterfassung]
  );

  const entriesByDay = useCallback((day: Date) => {
    return filteredEntries.filter(e => {
      if (!e.fields.datum) return false;
      try { return isSameDay(parseISO(e.fields.datum), day); } catch { return false; }
    });
  }, [filteredEntries]);

  const handleOpenCreate = (date?: Date) => {
    setEditRecord(null);
    setDefaultDate(date ? format(date, 'yyyy-MM-dd') : undefined);
    setDialogOpen(true);
  };

  const handleOpenEdit = (entry: EnrichedZeiterfassung) => {
    setEditRecord(entry);
    setDefaultDate(undefined);
    setDialogOpen(true);
  };

  const handleCreate = async (fields: Zeiterfassung['fields']) => {
    await LivingAppsService.createZeiterfassungEntry(fields);
    fetchAll();
  };

  const handleUpdate = async (fields: Zeiterfassung['fields']) => {
    if (!editRecord) return;
    await LivingAppsService.updateZeiterfassungEntry(editRecord.record_id, fields);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteZeiterfassungEntry(deleteTarget);
    setDeleteTarget(null);
    fetchAll();
  };

  const dialogDefaultValues = useMemo(() => {
    if (editRecord) return editRecord.fields;
    if (defaultDate) {
      const mOpt = selectedMitarbeiter !== 'all'
        ? { mitarbeiter_ref: createRecordUrl(APP_IDS.MITARBEITER, selectedMitarbeiter) }
        : {};
      return { datum: defaultDate, ...mOpt };
    }
    return undefined;
  }, [editRecord, defaultDate, selectedMitarbeiter]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const today = new Date();
  const isCurrentWeek = isSameDay(weekStart, startOfWeek(today, { weekStartsOn: 1 }));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Stunden diese Woche"
          value={totalHoursThisWeek.toFixed(1)}
          description={selectedMitarbeiter === 'all' ? 'Alle Mitarbeiter' : 'Gefiltert'}
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Einträge diese Woche"
          value={String(filteredEntries.length)}
          description="Zeitbuchungen"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Mitarbeiter"
          value={String(mitarbeiter.length)}
          description="Gesamt erfasst"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Stunden gesamt"
          value={totalHoursAll.toFixed(1)}
          description="Alle Zeiten"
          icon={<IconBriefcase size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Week Navigator + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
            <IconChevronLeft size={16} />
          </Button>
          <div className="px-3 py-1 rounded-lg bg-muted text-sm font-medium min-w-[160px] text-center">
            {format(weekStart, 'd. MMM', { locale: de })} – {format(weekEnd, 'd. MMM yyyy', { locale: de })}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
            <IconChevronRight size={16} />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCurrentWeek(new Date())}>
              Heute
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedMitarbeiter('all')}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${selectedMitarbeiter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
          >
            Alle
          </button>
          {mitarbeiter.map(m => (
            <button
              key={m.record_id}
              onClick={() => setSelectedMitarbeiter(m.record_id)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${selectedMitarbeiter === m.record_id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
            >
              {m.fields.vorname} {m.fields.nachname}
            </button>
          ))}
        </div>

        <Button size="sm" className="ml-auto shrink-0" onClick={() => handleOpenCreate()}>
          <IconPlus size={16} className="mr-1 shrink-0" />
          <span className="hidden sm:inline">Neue Buchung</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekDays.map(day => {
          const dayEntries = entriesByDay(day);
          const dayHours = dayEntries.reduce((s, e) => s + (e.fields.dauer_stunden ?? 0), 0);
          const isToday = isSameDay(day, today);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={day.toISOString()}
              className={`rounded-2xl border overflow-hidden flex flex-col min-h-[160px] ${isToday ? 'border-primary/50 bg-primary/5' : isWeekend ? 'border-border/50 bg-muted/30' : 'border-border bg-card'}`}
            >
              {/* Day Header */}
              <div
                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors ${isToday ? 'bg-primary/10' : ''}`}
                onClick={() => handleOpenCreate(day)}
              >
                <div>
                  <div className={`text-xs font-medium uppercase tracking-wide ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, 'EEE', { locale: de })}
                  </div>
                  <div className={`text-lg font-bold leading-none ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {dayHours > 0 && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {dayHours.toFixed(1)}h
                    </span>
                  )}
                  <IconPlus size={14} className={`shrink-0 ${isToday ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
              </div>

              {/* Entries */}
              <div className="flex-1 flex flex-col gap-1.5 p-2 overflow-y-auto max-h-[280px]">
                {dayEntries.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground/50">—</span>
                  </div>
                ) : (
                  dayEntries.map(entry => {
                    const mandantKey = entry.fields.mandant?.key ?? '';
                    const mandantColor = MANDANT_COLORS[mandantKey] ?? 'bg-gray-100 text-gray-700 border-gray-200';
                    return (
                      <div
                        key={entry.record_id}
                        className="group rounded-xl border bg-background p-2 flex flex-col gap-1 cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => handleOpenEdit(entry)}
                      >
                        <div className="flex items-start justify-between gap-1 min-w-0">
                          <div className="min-w-0 flex-1">
                            {entry.mitarbeiter_refName && (
                              <div className="text-xs font-semibold text-foreground truncate">
                                {entry.mitarbeiter_refName}
                              </div>
                            )}
                            {entry.taetigkeit_refName && (
                              <div className="text-xs text-muted-foreground truncate">
                                {entry.taetigkeit_refName}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              className="p-1 rounded-lg hover:bg-accent transition-colors"
                              onClick={e => { e.stopPropagation(); handleOpenEdit(entry); }}
                            >
                              <IconPencil size={12} className="text-muted-foreground" />
                            </button>
                            <button
                              className="p-1 rounded-lg hover:bg-destructive/10 transition-colors"
                              onClick={e => { e.stopPropagation(); setDeleteTarget(entry.record_id); }}
                            >
                              <IconTrash size={12} className="text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {entry.fields.dauer_stunden != null && (
                            <span className="text-xs font-bold text-foreground">
                              {entry.fields.dauer_stunden}h
                            </span>
                          )}
                          {entry.fields.startzeit && entry.fields.endzeit && (
                            <span className="text-xs text-muted-foreground">
                              {entry.fields.startzeit}–{entry.fields.endzeit}
                            </span>
                          )}
                          {entry.fields.mandant && (
                            <Badge className={`text-xs px-1.5 py-0 border ${mandantColor} font-normal`}>
                              {entry.fields.mandant.label}
                            </Badge>
                          )}
                        </div>
                        {entry.fields.notiz && (
                          <div className="text-xs text-muted-foreground line-clamp-1 italic">
                            {entry.fields.notiz}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Entries List (below week view for context) */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Alle Buchungen dieser Woche</h2>
          <span className="text-xs text-muted-foreground">{filteredEntries.length} Einträge · {totalHoursThisWeek.toFixed(1)} Stunden</span>
        </div>
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <IconClock size={32} className="text-muted-foreground/40" stroke={1.5} />
            <div className="text-sm text-muted-foreground text-center">
              Keine Einträge in dieser Woche.<br />
              <button className="text-primary hover:underline" onClick={() => handleOpenCreate()}>Erste Buchung erfassen</button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Datum</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Mitarbeiter</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Tätigkeit</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Mandant</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Zeit</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stunden</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries
                  .slice()
                  .sort((a, b) => (a.fields.datum ?? '') < (b.fields.datum ?? '') ? -1 : 1)
                  .map(entry => {
                    const mandantKey = entry.fields.mandant?.key ?? '';
                    const mandantColor = MANDANT_COLORS[mandantKey] ?? 'bg-gray-100 text-gray-700 border-gray-200';
                    return (
                      <tr key={entry.record_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(entry.fields.datum)}</td>
                        <td className="px-4 py-2.5 max-w-[140px] truncate">{entry.mitarbeiter_refName || '—'}</td>
                        <td className="px-4 py-2.5 max-w-[140px] truncate hidden md:table-cell">{entry.taetigkeit_refName || '—'}</td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          {entry.fields.mandant ? (
                            <Badge className={`text-xs px-1.5 py-0 border ${mandantColor} font-normal`}>
                              {entry.fields.mandant.label}
                            </Badge>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                          {entry.fields.startzeit && entry.fields.endzeit
                            ? `${entry.fields.startzeit}–${entry.fields.endzeit}`
                            : entry.fields.startzeit ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 font-semibold">
                          {entry.fields.dauer_stunden != null ? `${entry.fields.dauer_stunden}h` : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                              onClick={() => handleOpenEdit(entry)}
                            >
                              <IconPencil size={14} className="text-muted-foreground" />
                            </button>
                            <button
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                              onClick={() => setDeleteTarget(entry.record_id)}
                            >
                              <IconTrash size={14} className="text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mandant Summary */}
      {filteredEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {LOOKUP_OPTIONS['zeiterfassung']?.mandant?.map(opt => {
            const hours = filteredEntries
              .filter(e => e.fields.mandant?.key === opt.key)
              .reduce((s, e) => s + (e.fields.dauer_stunden ?? 0), 0);
            const color = MANDANT_COLORS[opt.key] ?? 'bg-gray-100 text-gray-700 border-gray-200';
            if (hours === 0) return null;
            return (
              <div key={opt.key} className={`rounded-2xl border p-4 ${color}`}>
                <div className="text-xs font-medium opacity-70 mb-1">{opt.label}</div>
                <div className="text-2xl font-bold">{hours.toFixed(1)}h</div>
                <div className="text-xs opacity-60 mt-0.5">diese Woche</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <ZeiterfassungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={async (fields) => {
          if (editRecord) {
            await handleUpdate(fields);
          } else {
            await handleCreate(fields);
          }
        }}
        defaultValues={dialogDefaultValues}
        mitarbeiterList={mitarbeiter}
        taetigkeitenList={taetigkeiten}
        enablePhotoScan={AI_PHOTO_SCAN['Zeiterfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Zeiterfassung']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Buchung löschen"
        description="Möchtest du diese Zeitbuchung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24 ml-auto" />
      </div>
      <div className="grid grid-cols-7 gap-3">
        {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
