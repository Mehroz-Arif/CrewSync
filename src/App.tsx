import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import DashboardLayout from "./pages/dashboard/_components/dashboard-layout.tsx";
import DashboardPage from "./pages/dashboard/page.tsx";
import MessagesPage from "./pages/messages/page.tsx";
import ShiftsPage from "./pages/shifts/page.tsx";
import SettingsPage from "./pages/settings/page.tsx";
import RewardsPage from "./pages/rewards/page.tsx";
import DocumentsPage from "./pages/documents/page.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/shifts" element={<ShiftsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<MessagesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
