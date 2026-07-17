import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

import Home from './pages/Home';
import AppLayout from './components/layout/AppLayout';
import { ClientActionsProvider } from './lib/ClientActionsContext';
import { GlobalSelectorProvider } from '@/lib/GlobalSelectorContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

const LeaderDashboard = lazy(() => import('./pages/LeaderDashboard'));
const LeaderPipeline = lazy(() => import('./pages/LeaderPipeline'));
const FirmwideClients = lazy(() => import('./pages/firmwide/FirmwideClients'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const Collections = lazy(() => import('./pages/Collections'));
const Clients = lazy(() => import('./pages/Clients.jsx'));
const Actions = lazy(() => import('./pages/Actions'));
const TeamView = lazy(() => import('./pages/TeamView'));
const BlueSkyPage = lazy(() => import('./pages/BlueSkyPage'));
const Origination = lazy(() => import('./pages/firmwide/Origination'));
const BoardPack = lazy(() => import('./pages/firmwide/BoardPack'));
const ConsolidatedSummary = lazy(() => import('./pages/firmwide/ConsolidatedSummary'));
const ChangeLog = lazy(() => import('./pages/firmwide/ChangeLog'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const ClientMeetings = lazy(() => import('./pages/ClientMeetings'));

function PageLoader() {
  return (
    <div className="space-y-6 p-1">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function LazyPage({ children }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const AuthenticatedApp = () => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="executive-shell flex min-h-screen items-center justify-center">
        <div className="exec-blob-mid" />
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--violet)]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    );
  }

  return (
    <ErrorBoundary>
      <GlobalSelectorProvider>
      <ClientActionsProvider>
        <Routes>
          <Route element={<AppLayout user={user} />}>
            <Route path="/" element={<LazyPage><LeaderDashboard user={user} /></LazyPage>} />
            <Route path="/my-plan/dashboard" element={<LazyPage><LeaderDashboard user={user} /></LazyPage>} />
            <Route path="/my-plan" element={<LazyPage><Clients user={user} /></LazyPage>} />
            <Route path="/my-plan/collections" element={<LazyPage><Collections user={user} /></LazyPage>} />
            <Route path="/my-plan/team" element={<LazyPage><TeamView user={user} /></LazyPage>} />
            <Route path="/my-plan/clients" element={<LazyPage><Clients user={user} /></LazyPage>} />
            <Route path="/my-plan/engagements" element={<LazyPage><Clients user={user} /></LazyPage>} />
            <Route path="/my-plan/pipeline" element={<LazyPage><LeaderPipeline user={user} /></LazyPage>} />
            <Route path="/my-plan/clients/:clientId" element={<LazyPage><ClientDetail user={user} /></LazyPage>} />
            <Route path="/my-plan/actions" element={<LazyPage><Actions user={user} /></LazyPage>} />
            <Route path="/my-plan/meetings" element={<LazyPage><ClientMeetings user={user} /></LazyPage>} />
            <Route path="/my-plan/blue-sky-summary" element={<LazyPage><BlueSkyPage user={user} /></LazyPage>} />
            <Route path="/firmwide" element={<Navigate to="/firmwide/consolidated" replace />} />
            <Route path="/firmwide/leaders" element={<Navigate to="/firmwide/consolidated" replace />} />
            <Route path="/firmwide/team" element={<Navigate to="/firmwide/consolidated" replace />} />
            <Route path="/firmwide/clients" element={<ProtectedRoute allowedRoles={['management', 'admin']}><LazyPage><FirmwideClients /></LazyPage></ProtectedRoute>} />
            <Route path="/firmwide/origination" element={<ProtectedRoute allowedRoles={['management', 'admin']}><LazyPage><Origination /></LazyPage></ProtectedRoute>} />
            <Route path="/firmwide/board-pack" element={<ProtectedRoute allowedRoles={['management', 'admin']}><LazyPage><BoardPack /></LazyPage></ProtectedRoute>} />
            <Route path="/firmwide/consolidated" element={<ProtectedRoute allowedRoles={['management', 'admin']}><LazyPage><ConsolidatedSummary /></LazyPage></ProtectedRoute>} />
            <Route path="/firmwide/change-log" element={<ProtectedRoute allowedRoles={['management', 'admin', 'user']}><LazyPage><ChangeLog /></LazyPage></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><LazyPage><AdminSettings /></LazyPage></ProtectedRoute>} />
          </Route>
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </ClientActionsProvider>
    </GlobalSelectorProvider>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
