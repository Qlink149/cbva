import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

import Home from './pages/Home';
import LeaderDashboard from './pages/LeaderDashboard';
import LeaderPipeline from './pages/LeaderPipeline';
import FirmwideClients from './pages/firmwide/FirmwideClients';
import AdminSettings from './pages/AdminSettings';
import AppLayout from './components/layout/AppLayout';
import Collections from './pages/Collections';
import Clients from './pages/Clients.jsx';
import Actions from './pages/Actions';
import TeamView from './pages/TeamView';
import BlueSkyPage from './pages/BlueSkyPage';
import GoalSetting from './pages/GoalSetting';
import Origination from './pages/firmwide/Origination';
import BoardPack from './pages/firmwide/BoardPack';
import ConsolidatedSummary from './pages/firmwide/ConsolidatedSummary';
import FirmwideTeam from './pages/firmwide/FirmwideTeam';
import ClientDetail from './pages/ClientDetail';
import ClientMeetings from './pages/ClientMeetings';
import { ClientActionsProvider } from './lib/ClientActionsContext';
import { GlobalSelectorProvider } from '@/lib/GlobalSelectorContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

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
            <Route path="/" element={<LeaderDashboard user={user} />} />
            <Route path="/my-plan/dashboard" element={<LeaderDashboard user={user} />} />
            <Route path="/my-plan" element={<Clients user={user} />} />
            <Route path="/my-plan/collections" element={<Collections user={user} />} />
            <Route path="/my-plan/team" element={<TeamView user={user} />} />
            <Route path="/my-plan/clients" element={<Clients user={user} />} />
            <Route path="/my-plan/engagements" element={<Clients user={user} />} />
            <Route path="/my-plan/pipeline" element={<LeaderPipeline user={user} />} />
            <Route path="/my-plan/clients/:clientId" element={<ClientDetail user={user} />} />
            <Route path="/my-plan/actions" element={<Actions user={user} />} />
            <Route path="/my-plan/meetings" element={<ClientMeetings user={user} />} />
            <Route path="/my-plan/blue-sky-summary" element={<BlueSkyPage user={user} />} />
            <Route path="/firmwide" element={<Navigate to="/firmwide/consolidated" replace />} />
            <Route path="/firmwide/leaders" element={<Navigate to="/firmwide/consolidated" replace />} />
            <Route path="/firmwide/clients" element={<ProtectedRoute allowedRoles={['management', 'admin']}><FirmwideClients /></ProtectedRoute>} />
            <Route path="/firmwide/origination" element={<ProtectedRoute allowedRoles={['management', 'admin']}><Origination /></ProtectedRoute>} />
            <Route path="/firmwide/board-pack" element={<ProtectedRoute allowedRoles={['management', 'admin']}><BoardPack /></ProtectedRoute>} />
            <Route path="/firmwide/consolidated" element={<ProtectedRoute allowedRoles={['management', 'admin']}><ConsolidatedSummary /></ProtectedRoute>} />
            <Route path="/firmwide/team" element={<ProtectedRoute allowedRoles={['management', 'admin']}><FirmwideTeam /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />
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
