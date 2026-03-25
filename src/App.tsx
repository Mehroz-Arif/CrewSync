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
import FeedbackPage from "./pages/feedback/page.tsx";
import CalendarPage from "./pages/calendar/page.tsx";
import ReportsPage from "./pages/reports/page.tsx";
import TeamPage from "./pages/team/page.tsx";
import ProfilePage from "./pages/team/profile.tsx";
import SuperAdminPage from "./pages/admin/page.tsx";
import SuperAdminOrgDetailPage from "./pages/admin/org-detail.tsx";

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
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/team/:userId" element={<ProfilePage />} />
            <Route path="/admin" element={<SuperAdminPage />} />
            <Route path="/admin/org/:orgId" element={<SuperAdminOrgDetailPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
