import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, integrationsApi, organizationApi } from '@/api/client';
import { useAuthStore } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Building2, Plug, FileText, PartyPopper, ArrowRight, ArrowLeft,
  CheckCircle2, XCircle, Loader2, Ship, Globe, Zap, ChevronRight,
} from 'lucide-react';

// ─── Step definitions ─────────────────────────────────────
const STEPS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'api', label: 'API Connection', icon: Plug },
  { id: 'next', label: 'Get Started', icon: FileText },
  { id: 'done', label: 'All Set!', icon: PartyPopper },
] as const;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState(0);

  // ─── Step 1: Company Profile ────────────────────────────
  const [companyName, setCompanyName] = useState(user?.organization?.name || '');
  const [iorNumber, setIorNumber] = useState('');
  const [einNumber, setEinNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');

  // ─── Step 2: API Connection ─────────────────────────────
  const [connectionResult, setConnectionResult] = useState<{
    connected: boolean; environment: string; baseUrl: string;
  } | null>(null);

  // ─── Mutations ──────────────────────────────────────────
  const updateOrg = useMutation({
    mutationFn: (data: Record<string, any>) => settingsApi.updateOrganization(data),
  });

  const testConnection = useMutation({
    mutationFn: () => integrationsApi.testConnection(),
    onSuccess: (result) => {
      setConnectionResult(result);
      if (result.connected) {
        toast.success('CBP Filing Gateway connected successfully!');
      } else {
        toast.error('Connection failed — check your API key in environment settings');
      }
    },
    onError: () => {
      toast.error('Connection test failed');
    },
  });

  const completeOnboarding = useMutation({
    mutationFn: () => organizationApi.completeOnboarding(),
    onSuccess: () => {
      // Update local user state
      if (user) {
        setUser({
          ...user,
          organization: { ...user.organization, onboardingCompleted: true },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  // ─── Navigation ─────────────────────────────────────────
  const handleNext = async () => {
    if (step === 0) {
      // Save company profile
      try {
        await updateOrg.mutateAsync({
          name: companyName.trim() || undefined,
          iorNumber: iorNumber.trim() || undefined,
          einNumber: einNumber.trim() || undefined,
        });
        toast.success('Company profile saved');
      } catch {
        toast.error('Failed to save company profile');
        return;
      }
    }

    if (step === 2) {
      // Mark onboarding complete
      try {
        await completeOnboarding.mutateAsync();
      } catch {
        toast.error('Failed to complete onboarding');
        return;
      }
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleGoToDashboard = () => navigate('/', { replace: true });
  const handleGoToNewFiling = () => navigate('/shipments/new', { replace: true });

  const isNextDisabled =
    (step === 0 && !companyName.trim()) ||
    updateOrg.isPending ||
    completeOnboarding.isPending;

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      {/* Top bar */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/70 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ship className="h-7 w-7 text-primary" />
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">MyCargoLens</span>
          </div>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.1em] font-semibold">Setup</Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 mb-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isCompleted = i < step;
            return (
              <div key={s.id} className="flex items-center">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300',
                  isActive && 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 dark:ring-amber-400/30',
                  isCompleted && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-200/60 dark:ring-emerald-500/20',
                  !isActive && !isCompleted && 'bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500',
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className={cn(
                    'h-4 w-4 mx-1',
                    isCompleted ? 'text-emerald-400 dark:text-emerald-500' : 'text-slate-300 dark:text-slate-700',
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* ─── Step 0: Company Profile ────────────────────── */}
        {step === 0 && (
          <Card className="animate-fade-in-up border border-slate-200 dark:border-slate-800 shadow-sm dark:bg-slate-900/40">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-300/60 dark:ring-amber-400/40 shadow-[0_8px_20px_-10px_rgba(245,158,11,0.5)] flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-amber-950" />
                </div>
                <div>
                  <CardTitle className="text-xl">Welcome! Let's set up your company</CardTitle>
                  <CardDescription>This helps pre-fill your ISF filings with importer information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="font-semibold">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Import Solutions Inc."
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ior" className="font-semibold">Importer of Record (IOR) Number</Label>
                  <Input
                    id="ior"
                    value={iorNumber}
                    onChange={(e) => setIorNumber(e.target.value)}
                    placeholder="e.g. 12-3456789"
                  />
                  <p className="text-xs text-muted-foreground">CBP-assigned IRS/EIN number</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ein" className="font-semibold">EIN Number</Label>
                  <Input
                    id="ein"
                    value={einNumber}
                    onChange={(e) => setEinNumber(e.target.value)}
                    placeholder="e.g. 12-3456789"
                  />
                  <p className="text-xs text-muted-foreground">Employer Identification Number</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 1: API Connection ─────────────────────── */}
        {step === 1 && (
          <Card className="animate-fade-in-up border border-slate-200 dark:border-slate-800 shadow-sm dark:bg-slate-900/40">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                  <Plug className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Connect to CBP Filing Gateway</CardTitle>
                  <CardDescription>Test your API connection to start filing ISFs electronically</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl bg-amber-50/60 dark:bg-amber-500/[0.06] border border-amber-200/60 dark:border-amber-500/20 p-5">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-amber-900 dark:text-amber-300">
                  <Globe className="h-4 w-4" />
                  How it works
                </h4>
                <p className="text-sm text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                  MyCargoLens connects to the <strong>CBP Filing Gateway</strong> to electronically submit your ISF filings
                  to U.S. Customs & Border Protection (CBP). Your API credentials are configured in the server
                  environment — click below to verify the connection.
                </p>
              </div>

              <div className="flex flex-col items-center gap-4 py-4">
                <Button
                  size="lg"
                  onClick={() => testConnection.mutate()}
                  disabled={testConnection.isPending}
                  className="min-w-[200px]"
                >
                  {testConnection.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>

                {connectionResult && (
                  <div className={cn(
                    'flex items-center gap-3 px-5 py-3 rounded-xl border',
                    connectionResult.connected
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800',
                  )}>
                    {connectionResult.connected ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-semibold text-sm">
                        {connectionResult.connected ? 'Connected successfully!' : 'Connection failed'}
                      </p>
                      <p className="text-xs opacity-80">
                        Environment: {connectionResult.environment} · {connectionResult.baseUrl}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> You can skip this step and configure the API connection later
                  in <strong>Settings → API & Integrations</strong>. The sandbox environment is
                  pre-configured for testing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 2: Get Started ────────────────────────── */}
        {step === 2 && (
          <Card className="animate-fade-in-up border border-slate-200 dark:border-slate-800 shadow-sm dark:bg-slate-900/40">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-300/60 dark:ring-amber-400/40 shadow-[0_8px_20px_-10px_rgba(245,158,11,0.5)] flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-950" />
                </div>
                <div>
                  <CardTitle className="text-xl">You're almost ready!</CardTitle>
                  <CardDescription>Choose how you'd like to get started with MyCargoLens</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4">
                <button
                  onClick={() => {
                    handleNext();
                    // Will navigate to new filing after onboarding completes
                    setTimeout(() => navigate('/shipments/new', { replace: true }), 300);
                  }}
                  className="flex items-start gap-4 p-5 rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/[0.05] hover:bg-amber-50 dark:hover:bg-amber-500/[0.08] hover:border-amber-300 dark:hover:border-amber-500/30 transition-colors duration-200 cursor-pointer text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-300/60 dark:ring-amber-400/40 shadow-[0_8px_20px_-10px_rgba(245,158,11,0.5)] flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-amber-950" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1 text-slate-900 dark:text-slate-50">Create your first ISF filing</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Jump right in and create an ISF-10 or ISF-5 filing with our step-by-step wizard.
                      Perfect if you have a shipment ready to file.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-1 flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-200 motion-reduce:transform-none" />
                </button>

                <button
                  onClick={async () => {
                    await handleNext();
                    setTimeout(() => navigate('/', { replace: true }), 300);
                  }}
                  className="flex items-start gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors duration-200 cursor-pointer text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 flex items-center justify-center flex-shrink-0">
                    <Globe className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1 text-slate-900 dark:text-slate-50">Explore the dashboard first</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Take a look around the platform — browse the dashboard, check compliance tools,
                      and get familiar before creating your first filing.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 mt-1 flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-200 motion-reduce:transform-none" />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 3: Done ───────────────────────────────── */}
        {step === 3 && (
          <Card className="animate-fade-in-up border border-slate-200 dark:border-slate-800 shadow-sm dark:bg-slate-900/40 text-center">
            <CardContent className="py-14">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 ring-1 ring-amber-300/60 dark:ring-amber-400/40 shadow-[0_12px_36px_-12px_rgba(245,158,11,0.55)] mb-6">
                <PartyPopper className="h-10 w-10 text-amber-950" />
              </div>
              <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-50">You're all set</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                Your organization is configured and ready to go. Start filing ISFs,
                invite team members, and manage your compliance from one place.
              </p>

              <div className="flex items-center justify-center gap-3">
                <Button size="lg" onClick={handleGoToNewFiling}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create First Filing
                </Button>
                <Button size="lg" variant="outline" onClick={handleGoToDashboard}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Navigation buttons ─────────────────────────── */}
        {step < 2 && (
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0}
              className={cn(step === 0 && 'invisible')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <Button onClick={handleNext} disabled={isNextDisabled}>
              {updateOrg.isPending || completeOnboarding.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {step === 0 ? 'Save & Continue' : 'Continue'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Skip link */}
        {step < 2 && (
          <div className="text-center mt-4">
            <button
              onClick={async () => {
                try {
                  await completeOnboarding.mutateAsync();
                  navigate('/', { replace: true });
                } catch {
                  toast.error('Failed to skip onboarding');
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              Skip setup and go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
