import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
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
import ABIDocumentsListPage from "@/pages/ABIDocumentsListPage";
import ABIDocumentDetailPage from "@/pages/ABIDocumentDetailPage";
import ABIDocumentWizard from "@/pages/ABIDocumentWizard";
import IntegrationsApi from "@/pages/IntegrationsApi";
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

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
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
                <Route path="/manifest-query" element={<ErrorBoundary><ManifestQueryPage /></ErrorBoundary>} />
                <Route path="/abi-documents" element={<ErrorBoundary><ABIDocumentsListPage /></ErrorBoundary>} />
                <Route path="/abi-documents/new" element={<ErrorBoundary><ABIDocumentWizard /></ErrorBoundary>} />
                <Route path="/abi-documents/:id" element={<ErrorBoundary><ABIDocumentDetailPage /></ErrorBoundary>} />
                <Route path="/abi-documents/:id/edit" element={<ErrorBoundary><ABIDocumentWizard /></ErrorBoundary>} />
                <Route path="/integrations/api" element={<ErrorBoundary><IntegrationsApi /></ErrorBoundary>} />
                <Route path="/integrations/logs" element={<ErrorBoundary><SubmissionLogs /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                <Route path="/team" element={<ErrorBoundary><TeamPage /></ErrorBoundary>} />
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
