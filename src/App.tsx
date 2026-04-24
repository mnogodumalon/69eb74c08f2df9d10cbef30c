import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import MitarbeiterPage from '@/pages/MitarbeiterPage';
import TaetigkeitenPage from '@/pages/TaetigkeitenPage';
import ZeiterfassungPage from '@/pages/ZeiterfassungPage';
import PublicFormMitarbeiter from '@/pages/public/PublicForm_Mitarbeiter';
import PublicFormTaetigkeiten from '@/pages/public/PublicForm_Taetigkeiten';
import PublicFormZeiterfassung from '@/pages/public/PublicForm_Zeiterfassung';
// <public:imports>
// </public:imports>
// <custom:imports>
const TageserfassungPage = lazy(() => import('@/pages/intents/TageserfassungPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/69eb749bd1b6e71887fae80e" element={<PublicFormMitarbeiter />} />
              <Route path="public/69eb74a2c7c186f25a3f3290" element={<PublicFormTaetigkeiten />} />
              <Route path="public/69eb74a400a81b8be060f8aa" element={<PublicFormZeiterfassung />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="mitarbeiter" element={<MitarbeiterPage />} />
                <Route path="taetigkeiten" element={<TaetigkeitenPage />} />
                <Route path="zeiterfassung" element={<ZeiterfassungPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/tageserfassung" element={<Suspense fallback={null}><TageserfassungPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
