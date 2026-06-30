import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlatformAdminRoute } from "@/components/PlatformAdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CapabilityGate } from "@/components/CapabilityGate";
import { CAPABILITIES } from "@/lib/planMeta";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import { SetPasswordPage } from "@/pages/SetPasswordPage";
import { AdminClientsPage } from "@/pages/AdminClientsPage";
import { AdminChatConsolePage } from "@/pages/AdminChatConsolePage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import OnboardingPage from "@/pages/OnboardingPage";
import UpgradePage from "@/pages/UpgradePage";
import UpgradeSuccessPage from "@/pages/UpgradeSuccessPage";
import UpgradeCancelPage from "@/pages/UpgradeCancelPage";
import Dashboard from "@/pages/Dashboard";
import ShipmentsList from "@/pages/ShipmentsList";
import ShipmentDetails from "@/pages/ShipmentDetails";
import ShipmentWizard from "@/pages/ShipmentWizard";
import CompliancePage from "@/pages/CompliancePage";
import ManifestQueryPage from "@/pages/ManifestQueryPage";
import DutyCalculatorPage from "@/pages/DutyCalculatorPage";
import ABIDocumentsListPage from "@/pages/ABIDocumentsListPage";
import ABIDocumentDetailPage from "@/pages/ABIDocumentDetailPage";
import ABIDocumentWizard from "@/pages/ABIDocumentWizard";
import IntegrationsApi from "@/pages/IntegrationsApi";
import TrackingPage from "@/pages/TrackingPage";
import TrackingDetailPage from "@/pages/TrackingDetailPage";
import SubmissionLogs from "@/pages/SubmissionLogs";
import SettingsPage from "@/pages/SettingsPage";
import TeamPage from "@/pages/TeamPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,          // 30s before data is considered stale
      refetchOnWindowFocus: true,  // refetch when user returns to tab
      refetchOnReconnect: true,    // refetch after network reconnect
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* Set first password (sales-led onboarding) — public; the token is the credential */}
            <Route path="/set-password" element={<ErrorBoundary><SetPasswordPage /></ErrorBoundary>} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              {/* Email verification — full-page, no sidebar. Must live inside
                  ProtectedRoute (auth required) but ProtectedRoute itself
                  whitelists this path so an unverified user can reach it. */}
              <Route path="/verify-email" element={<ErrorBoundary><VerifyEmailPage /></ErrorBoundary>} />

              {/* Onboarding — full-page, no sidebar */}
              <Route path="/onboarding" element={<ErrorBoundary><OnboardingPage /></ErrorBoundary>} />

              {/* Upgrade flow — full-page, no sidebar */}
              <Route path="/upgrade" element={<ErrorBoundary><UpgradePage /></ErrorBoundary>} />
              <Route path="/upgrade/success" element={<ErrorBoundary><UpgradeSuccessPage /></ErrorBoundary>} />
              <Route path="/upgrade/cancel" element={<ErrorBoundary><UpgradeCancelPage /></ErrorBoundary>} />

              {/* Main app with sidebar layout */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                <Route path="/shipments" element={<ErrorBoundary><ShipmentsList /></ErrorBoundary>} />
                <Route path="/shipments/new" element={<ErrorBoundary><ShipmentWizard /></ErrorBoundary>} />
                <Route path="/shipments/:id" element={<ErrorBoundary><ShipmentDetails /></ErrorBoundary>} />
                <Route path="/shipments/:id/edit" element={<ErrorBoundary><ShipmentWizard /></ErrorBoundary>} />
                <Route path="/compliance" element={<ErrorBoundary><CompliancePage /></ErrorBoundary>} />
                <Route path="/tracking" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.CONTAINER_TRACKING}><TrackingPage /></CapabilityGate></ErrorBoundary>} />
                <Route path="/tracking/:id" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.CONTAINER_TRACKING}><TrackingDetailPage /></CapabilityGate></ErrorBoundary>} />
                <Route path="/manifest-query" element={<ErrorBoundary><ManifestQueryPage /></ErrorBoundary>} />
                <Route path="/duty-calculator" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.HTS_CLASSIFICATION}><DutyCalculatorPage /></CapabilityGate></ErrorBoundary>} />
                <Route path="/abi-documents" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.ABI_ENTRY}><ABIDocumentsListPage /></CapabilityGate></ErrorBoundary>} />
                <Route path="/abi-documents/new" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.ABI_ENTRY}><ABIDocumentWizard /></CapabilityGate></ErrorBoundary>} />
                <Route path="/abi-documents/:id" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.ABI_ENTRY}><ABIDocumentDetailPage /></CapabilityGate></ErrorBoundary>} />
                <Route path="/abi-documents/:id/edit" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.ABI_ENTRY}><ABIDocumentWizard /></CapabilityGate></ErrorBoundary>} />
                <Route path="/integrations/api" element={<ErrorBoundary><IntegrationsApi /></ErrorBoundary>} />
                <Route path="/integrations/logs" element={<ErrorBoundary><SubmissionLogs /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                <Route path="/team" element={<ErrorBoundary><TeamPage /></ErrorBoundary>} />

                {/* Platform-admin only — client provisioning console */}
                <Route element={<PlatformAdminRoute />}>
                  <Route path="/admin" element={<ErrorBoundary><AdminClientsPage /></ErrorBoundary>} />
                  <Route path="/admin/chat" element={<ErrorBoundary><AdminChatConsolePage /></ErrorBoundary>} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
