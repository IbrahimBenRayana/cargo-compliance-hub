import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ShipmentsList from "@/pages/ShipmentsList";
import ShipmentDetails from "@/pages/ShipmentDetails";
import ShipmentWizard from "@/pages/ShipmentWizard";
import CompliancePage from "@/pages/CompliancePage";
import IntegrationsApi from "@/pages/IntegrationsApi";
import SubmissionLogs from "@/pages/SubmissionLogs";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
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
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
