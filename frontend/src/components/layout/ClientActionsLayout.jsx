import { ClientActionsProvider } from '@/lib/ClientActionsContext';

export default function ClientActionsLayout({ children }) {
  return <ClientActionsProvider>{children}</ClientActionsProvider>;
}
