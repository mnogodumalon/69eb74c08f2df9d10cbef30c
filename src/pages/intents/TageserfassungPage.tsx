import { useState, useEffect, useMemo } from 'react';
import { APP_IDS } from '@/types/app';
import type { Mitarbeiter, Taetigkeiten, Zeiterfassung } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { ZeiterfassungDialog } from '@/components/dialogs/ZeiterfassungDialog';
import { TaetigkeitenDialog } from '@/components/dialogs/TaetigkeitenDialog';
import { Button } from '@/components/ui/button';
import { IconPlus, IconTrash, IconClock, IconCheck, IconUser, IconCalendar, IconArrowLeft } from '@tabler/icons-react';

const MANDANT_COLORS: Record<string, string> = {
  bag: 'bg-blue-100 text-blue-700 border-blue-200',
  reichruthhard: 'bg-purple-100 text-purple-700 border-purple-200',
  juergen_reich: 'bg-amber-100 text-amber-700 border-amber-200',
  matthias_ruthhard: 'bg-green-100 text-green-700 border-green-200',
};

const WIZARD_STEPS = [
  { label: 'Mitarbeiter & Tag' },
  { label: 'Zeiteinträge' },
  { label: 'Zusammenfassung' },
];

function todayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd. MMMM yyyy', { locale: de });
  } catch {
    return dateStr;
  }
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} Std.`;
  return `${h}:${String(m).padStart(2, '0')} Std.`;
}

export default function TageserfassungPage() {
  // --- All state hooks before any early returns ---
  const [step, setStep] = useState(1);
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [taetigkeiten, setTaetigkeiten] = useState<Taetigkeiten[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [selectedMitarbeiterId, setSelectedMitarbeiterId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayString());
  const [sessionEntries, setSessionEntries] = useState<Zeiterfassung['fields'][]>([]);

  const [zeitDialogOpen, setZeitDialogOpen] = useState(false);
  const [taetDialogOpen, setTaetDialogOpen] = useState(false);
  const [mitarbeiterDialogOpen, setMitarbeiterDialogOpen] = useState(false);

  // Suppress unused warning — mitarbeiterDialogOpen used for future expansion but kept for type safety
  void mitarbeiterDialogOpen;

  // Deep-link: read ?mitarbeiterId from URL
  const [deepLinkId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    return params.get('mitarbeiterId');
  });

  // Load data
  useEffect(() => {
    async function fetchAll() {
      setError(null);
      try {
        const [mitarbeiterData, taetigkeitenData] = await Promise.all([
          LivingAppsService.getMitarbeiter(),
          LivingAppsService.getTaetigkeiten(),
        ]);
        setMitarbeiter(mitarbeiterData);
        setTaetigkeiten(taetigkeitenData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
      } finally {
        setLoading(false);
      }
    }
    void fetchAll();
  }, []);

  // Deep-link: auto-select mitarbeiter and jump to step 2 once data is loaded
  useEffect(() => {
    if (!loading && deepLinkId && mitarbeiter.length > 0) {
      const found = mitarbeiter.find(m => m.record_id === deepLinkId);
      if (found) {
        setSelectedMitarbeiterId(deepLinkId);
        setStep(2);
      }
    }
  }, [loading, deepLinkId, mitarbeiter]);

  const selectedMitarbeiter = useMemo(
    () => mitarbeiter.find(m => m.record_id === selectedMitarbeiterId) ?? null,
    [mitarbeiter, selectedMitarbeiterId]
  );

  const totalHours = useMemo(
    () => sessionEntries.reduce((sum, e) => sum + (e.dauer_stunden ?? 0), 0),
    [sessionEntries]
  );

  async function fetchTaetigkeiten() {
    try {
      const data = await LivingAppsService.getTaetigkeiten();
      setTaetigkeiten(data);
    } catch {
      // silently ignore
    }
  }

  function handleSelectMitarbeiter(id: string) {
    setSelectedMitarbeiterId(id);
    setStep(2);
  }

  function handleRemoveEntry(index: number) {
    setSessionEntries(prev => prev.filter((_, i) => i !== index));
  }

  function handleReset() {
    setSelectedMitarbeiterId(null);
    setSelectedDate(todayString());
    setSessionEntries([]);
    setStep(1);
  }

  function getTaetigkeitName(taetigkeit_ref?: string): string {
    if (!taetigkeit_ref) return '—';
    const id = extractRecordId(taetigkeit_ref);
    if (!id) return '—';
    const found = taetigkeiten.find(t => t.record_id === id);
    return found?.fields.taetigkeit_name ?? '—';
  }

  function getMandantLabel(mandant?: { key: string; label: string } | string): { key: string; label: string } | null {
    if (!mandant) return null;
    if (typeof mandant === 'object') return mandant;
    // plain key string — look up label
    const opt = [
      { key: 'bag', label: 'BAG' },
      { key: 'reichruthhard', label: 'ReichRuthhard' },
      { key: 'juergen_reich', label: 'Jürgen Reich' },
      { key: 'matthias_ruthhard', label: 'Matthias Ruthhard' },
    ].find(o => o.key === mandant);
    return opt ?? { key: mandant as string, label: mandant as string };
  }

  return (
    <IntentWizardShell
      title="Tageserfassung"
      subtitle="Mehrere Zeiteinträge für einen Mitarbeiter auf einmal erfassen"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={() => window.location.reload()}
    >
      {/* ── Step 1: Mitarbeiter & Tag auswählen ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold mb-1">Mitarbeiter auswählen</h2>
            <p className="text-sm text-muted-foreground mb-4">Wähle den Mitarbeiter, für den du Zeiten erfassen möchtest.</p>
            <EntitySelectStep
              items={mitarbeiter.map(m => ({
                id: m.record_id,
                title: [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || m.record_id,
                subtitle: m.fields.abteilung,
                icon: <IconUser size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectMitarbeiter}
              searchPlaceholder="Mitarbeiter suchen..."
              emptyText="Kein Mitarbeiter gefunden."
              emptyIcon={<IconUser size={32} />}
            />
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <IconCalendar size={18} className="text-primary shrink-0" />
              <h2 className="text-base font-semibold">Tag auswählen</h2>
            </div>
            <p className="text-sm text-muted-foreground">Für welchen Tag sollen die Einträge erfasst werden?</p>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex justify-end">
            <Button
              disabled={!selectedMitarbeiterId}
              onClick={() => setStep(2)}
              className="gap-2"
            >
              Weiter
              <IconCheck size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Zeiteinträge erfassen ── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Context header */}
          <div className="rounded-xl border bg-card p-4 flex items-start gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconUser size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">
                {selectedMitarbeiter
                  ? [selectedMitarbeiter.fields.vorname, selectedMitarbeiter.fields.nachname].filter(Boolean).join(' ')
                  : '—'}
              </p>
              {selectedMitarbeiter?.fields.abteilung && (
                <p className="text-xs text-muted-foreground truncate">{selectedMitarbeiter.fields.abteilung}</p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedDate ? formatDate(selectedDate) : '—'}
              </p>
            </div>
          </div>

          {/* Live counter */}
          <div className="rounded-xl border bg-secondary p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconClock size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold tabular-nums">
                {sessionEntries.length} {sessionEntries.length === 1 ? 'Eintrag' : 'Einträge'}
                {totalHours > 0 && (
                  <span className="text-primary"> · {formatHours(totalHours)}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Erfasst in dieser Sitzung</p>
            </div>
          </div>

          {/* Session entries list */}
          {sessionEntries.length > 0 && (
            <div className="space-y-2">
              {sessionEntries.map((entry, idx) => {
                const mandant = getMandantLabel(entry.mandant as { key: string; label: string } | string | undefined);
                const taetigkeitName = getTaetigkeitName(entry.taetigkeit_ref);
                return (
                  <div
                    key={idx}
                    className="rounded-xl border bg-card p-4 flex items-start gap-3 overflow-hidden"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{taetigkeitName}</span>
                        {mandant && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${MANDANT_COLORS[mandant.key] ?? 'bg-muted text-muted-foreground border-transparent'}`}>
                            {mandant.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {entry.startzeit && entry.endzeit && (
                          <span>{entry.startzeit} – {entry.endzeit}</span>
                        )}
                        {entry.dauer_stunden != null && entry.dauer_stunden > 0 && (
                          <span className="font-medium text-foreground">{formatHours(entry.dauer_stunden)}</span>
                        )}
                        {entry.notiz && (
                          <span className="truncate max-w-xs">{entry.notiz}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveEntry(idx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      aria-label="Eintrag entfernen"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add entry button */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={() => setZeitDialogOpen(true)}
            >
              <IconPlus size={16} />
              Eintrag hinzufügen
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setTaetDialogOpen(true)}
            >
              <IconPlus size={16} />
              Neue Tätigkeit anlegen
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="gap-2"
            >
              <IconArrowLeft size={16} />
              Zurück
            </Button>
            <Button
              disabled={sessionEntries.length === 0}
              onClick={() => setStep(3)}
              className="gap-2"
            >
              <IconCheck size={16} />
              Abschliessen
            </Button>
          </div>

          {/* Dialogs */}
          <ZeiterfassungDialog
            open={zeitDialogOpen}
            onClose={() => setZeitDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createZeiterfassungEntry(fields);
              setSessionEntries(prev => [...prev, fields]);
            }}
            defaultValues={{
              datum: selectedDate,
              mitarbeiter_ref: selectedMitarbeiterId
                ? createRecordUrl(APP_IDS.MITARBEITER, selectedMitarbeiterId)
                : undefined,
            }}
            mitarbeiterList={mitarbeiter}
            taetigkeitenList={taetigkeiten}
            enablePhotoScan={AI_PHOTO_SCAN['Zeiterfassung']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Zeiterfassung']}
          />

          <TaetigkeitenDialog
            open={taetDialogOpen}
            onClose={() => setTaetDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createTaetigkeitenEntry(fields);
              await fetchTaetigkeiten();
            }}
            enablePhotoScan={AI_PHOTO_SCAN['Taetigkeiten']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Taetigkeiten']}
          />
        </div>
      )}

      {/* ── Step 3: Zusammenfassung ── */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Summary card */}
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconCheck size={24} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Sitzung abgeschlossen</h2>
                <p className="text-sm text-muted-foreground">Alle Einträge wurden gespeichert.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-secondary p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{sessionEntries.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Einträge</p>
              </div>
              <div className="rounded-xl bg-secondary p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-primary">{formatHours(totalHours)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Stunden gesamt</p>
              </div>
              <div className="rounded-xl bg-secondary p-3 text-center col-span-2">
                <p className="text-sm font-semibold truncate">
                  {selectedMitarbeiter
                    ? [selectedMitarbeiter.fields.vorname, selectedMitarbeiter.fields.nachname].filter(Boolean).join(' ')
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedDate ? formatDate(selectedDate) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Entries breakdown table */}
          {sessionEntries.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Erfasste Einträge</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tätigkeit</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Zeitraum</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Stunden</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Mandant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionEntries.map((entry, idx) => {
                      const mandant = getMandantLabel(entry.mandant as { key: string; label: string } | string | undefined);
                      const taetigkeitName = getTaetigkeitName(entry.taetigkeit_ref);
                      return (
                        <tr key={idx} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium truncate max-w-[160px]">{taetigkeitName}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                            {entry.startzeit && entry.endzeit
                              ? `${entry.startzeit} – ${entry.endzeit}`
                              : entry.startzeit ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            {entry.dauer_stunden != null ? formatHours(entry.dauer_stunden) : '—'}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {mandant ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${MANDANT_COLORS[mandant.key] ?? 'bg-muted text-muted-foreground border-transparent'}`}>
                                {mandant.label}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold border-t">
                      <td className="px-4 py-3" colSpan={2}>Gesamt</td>
                      <td className="px-4 py-3 text-right tabular-nums text-primary">{formatHours(totalHours)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleReset}
            >
              <IconPlus size={16} />
              Neue Sitzung starten
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => { window.location.hash = '/'; }}
            >
              Zum Dashboard
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
