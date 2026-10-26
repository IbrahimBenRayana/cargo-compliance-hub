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
import { Suspense } from "react";
import { lazyPage } from "@/lib/lazyPage";
import { PageLoading } from "@/components/PageLoading";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/NotFound";

// Pages load on first visit (one 2.2 MB bundle otherwise); Login stays eager.
const RegisterPage = lazyPage(() => import("@/pages/RegisterPage"), "default");
const SetPasswordPage = lazyPage(() => import("@/pages/SetPasswordPage"), "SetPasswordPage");
const ForgotPasswordPage = lazyPage(() => import("@/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const AdminClientsPage = lazyPage(() => import("@/pages/AdminClientsPage"), "AdminClientsPage");
const AdminChatConsolePage = lazyPage(() => import("@/pages/AdminChatConsolePage"), "AdminChatConsolePage");
const AdminCertConsolePage = lazyPage(() => import("@/pages/AdminCertConsolePage"), "AdminCertConsolePage");
const AdminCbpTrafficPage = lazyPage(() => import("@/pages/AdminCbpTrafficPage"), "AdminCbpTrafficPage");
const VerifyEmailPage = lazyPage(() => import("@/pages/VerifyEmailPage"), "default");
const MfaSetupPage = lazyPage(() => import("@/pages/MfaSetupPage"), "default");
const OnboardingPage = lazyPage(() => import("@/pages/OnboardingPage"), "default");
const UpgradePage = lazyPage(() => import("@/pages/UpgradePage"), "default");
const UpgradeSuccessPage = lazyPage(() => import("@/pages/UpgradeSuccessPage"), "default");
const UpgradeCancelPage = lazyPage(() => import("@/pages/UpgradeCancelPage"), "default");
const Dashboard = lazyPage(() => import("@/pages/Dashboard"), "default");
const ShipmentsList = lazyPage(() => import("@/pages/ShipmentsList"), "default");
const ShipmentDetails = lazyPage(() => import("@/pages/ShipmentDetails"), "default");
const ShipmentWizard = lazyPage(() => import("@/pages/ShipmentWizard"), "default");
const CompliancePage = lazyPage(() => import("@/pages/CompliancePage"), "default");
const ManifestQueryPage = lazyPage(() => import("@/pages/ManifestQueryPage"), "default");
const DutyCalculatorPage = lazyPage(() => import("@/pages/DutyCalculatorPage"), "default");
const ABIDocumentsListPage = lazyPage(() => import("@/pages/ABIDocumentsListPage"), "default");
const ABIDocumentDetailPage = lazyPage(() => import("@/pages/ABIDocumentDetailPage"), "default");
const ABIDocumentWizard = lazyPage(() => import("@/pages/ABIDocumentWizard"), "default");
const InbondListPage = lazyPage(() => import("@/pages/InbondListPage"), "default");
const InbondDetailPage = lazyPage(() => import("@/pages/InbondDetailPage"), "default");
const InbondWizard = lazyPage(() => import("@/pages/InbondWizard"), "default");
const IntegrationsApi = lazyPage(() => import("@/pages/IntegrationsApi"), "default");
const TrackingPage = lazyPage(() => import("@/pages/TrackingPage"), "default");
const TrackingDetailPage = lazyPage(() => import("@/pages/TrackingDetailPage"), "default");
const SubmissionLogs = lazyPage(() => import("@/pages/SubmissionLogs"), "default");
const SettingsPage = lazyPage(() => import("@/pages/SettingsPage"), "default");
const TeamPage = lazyPage(() => import("@/pages/TeamPage"), "default");

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
          <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* Set first password (sales-led onboarding) — public; the token is the credential */}
            <Route path="/set-password" element={<ErrorBoundary><SetPasswordPage /></ErrorBoundary>} />
            <Route path="/forgot-password" element={<ErrorBoundary><ForgotPasswordPage /></ErrorBoundary>} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              {/* Email verification — full-page, no sidebar. Must live inside
                  ProtectedRoute (auth required) but ProtectedRoute itself
                  whitelists this path so an unverified user can reach it. */}
              <Route path="/verify-email" element={<ErrorBoundary><VerifyEmailPage /></ErrorBoundary>} />

              {/* Forced two-factor enrollment — full-page, no sidebar. Like
                  /verify-email, ProtectedRoute whitelists this path so a
                  must-enroll user can reach it. */}
              <Route path="/mfa-setup" element={<ErrorBoundary><MfaSetupPage /></ErrorBoundary>} />

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
                <Route path="/inbond" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.IN_BOND}><InbondListPage /></CapabilityGate></ErrorBoundary>} />
                <Route path="/inbond/new" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.IN_BOND}><InbondWizard /></CapabilityGate></ErrorBoundary>} />
                <Route path="/inbond/:id" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.IN_BOND}><InbondDetailPage /></CapabilityGate></ErrorBoundary>} />
                <Route path="/inbond/:id/edit" element={<ErrorBoundary><CapabilityGate capability={CAPABILITIES.IN_BOND}><InbondWizard /></CapabilityGate></ErrorBoundary>} />
                <Route path="/integrations/api" element={<ErrorBoundary><IntegrationsApi /></ErrorBoundary>} />
                <Route path="/integrations/logs" element={<ErrorBoundary><SubmissionLogs /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                <Route path="/team" element={<ErrorBoundary><TeamPage /></ErrorBoundary>} />

                {/* Platform-admin only — client provisioning console */}
                <Route element={<PlatformAdminRoute />}>
                  <Route path="/admin" element={<ErrorBoundary><AdminClientsPage /></ErrorBoundary>} />
                  <Route path="/admin/chat" element={<ErrorBoundary><AdminChatConsolePage /></ErrorBoundary>} />
                  <Route path="/admin/cert" element={<ErrorBoundary><AdminCertConsolePage /></ErrorBoundary>} />
                  <Route path="/admin/cbp" element={<ErrorBoundary><AdminCbpTrafficPage /></ErrorBoundary>} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
