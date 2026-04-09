import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import OnboardingPage from "@/pages/OnboardingPage";
import Dashboard from "@/pages/Dashboard";
import ShipmentsList from "@/pages/ShipmentsList";
import ShipmentDetails from "@/pages/ShipmentDetails";
import ShipmentWizard from "@/pages/ShipmentWizard";
import CompliancePage from "@/pages/CompliancePage";
import IntegrationsApi from "@/pages/IntegrationsApi";
import SubmissionLogs from "@/pages/SubmissionLogs";
import SettingsPage from "@/pages/SettingsPage";
import TeamPage from "@/pages/TeamPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
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
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Main app with sidebar layout */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/shipments" element={<ShipmentsList />} />
              <Route path="/shipments/new" element={<ShipmentWizard />} />
              <Route path="/shipments/:id" element={<ShipmentDetails />} />
              <Route path="/shipments/:id/edit" element={<ShipmentWizard />} />
              <Route path="/compliance" element={<CompliancePage />} />
              <Route path="/integrations/api" element={<IntegrationsApi />} />
              <Route path="/integrations/logs" element={<SubmissionLogs />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/team" element={<TeamPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
