import { useState, useMemo, useEffect } from 'react';
import { useFilings } from '@/hooks/useFilings';
import { Filing, getPartyName, getFirstCommodity, ShipmentStatus } from '@/types/shipment';
import { StatusBadge } from '@/components/StatusBadge';
import { filingsApi } from '@/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldCheck,
  Search,
  X,
  CheckCircle2,
  Loader2,
  FileText,
  ExternalLink,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Shield,
  TrendingUp,
  Ship,
  Package,
  Users,
  Globe,
  Lightbulb,
  Zap,
  ArrowUpRight,
  BarChart3,
  Eye,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'info';

interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: Severity;
}

interface FilingValidation {
  filingId: string;
  filing: Filing;
  valid: boolean;
  score: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  errors: ValidationError[];
}

// ─── Constants ─────────────────────────────────────────────

const severityConfig: Record<
  Severity,
  {
    icon: typeof AlertCircle;
    color: string;
    bgLight: string;
    bgDark: string;
    border: string;
    text: string;
    label: string;
  }
> = {
  critical: {
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
    bgLight: 'bg-red-50 dark:bg-red-950/30',
    bgDark: 'bg-red-100 dark:bg-red-900/40',
    border: 'border-red-200 dark:border-red-900/50',
    text: 'text-red-700 dark:text-red-300',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
    bgDark: 'bg-amber-100 dark:bg-amber-900/40',
    border: 'border-amber-200 dark:border-amber-900/50',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Warning',
  },
  info: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-50 dark:bg-blue-950/30',
    bgDark: 'bg-blue-100 dark:bg-blue-900/40',
    border: 'border-blue-200 dark:border-blue-900/50',
    text: 'text-blue-700 dark:text-blue-300',
    label: 'Info',
  },
};

type FilterMode = 'all' | 'issues' | 'clean';

// ─── Score Ring SVG ────────────────────────────────────────

function ScoreRing({
  score,
  size = 52,
  strokeWidth = 4,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 85
      ? 'stroke-emerald-500'
      : score >= 60
        ? 'stroke-amber-500'
        : 'stroke-red-500';
  const textColor =
    score >= 85
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted/40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(color, 'transition-all duration-1000 ease-out')}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-xs font-bold tabular-nums', textColor)}>
          {score}
        </span>
      </div>
    </div>
  );
}

// ─── Filing Compliance Card ────────────────────────────────

function FilingCard({
  validation,
  onClick,
}: {
  validation: FilingValidation;
  onClick: () => void;
}) {
  const { filing, score, criticalCount, warningCount, infoCount, valid } = validation;
  const commodity = getFirstCommodity(filing);

  const accentBorder = valid
    ? 'border-emerald-200/60 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-700'
    : criticalCount > 0
      ? 'border-red-200/60 dark:border-red-800/40 hover:border-red-300 dark:hover:border-red-700'
      : 'border-amber-200/60 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-700';

  const accentGlow = valid
    ? 'hover:shadow-emerald-100/50 dark:hover:shadow-emerald-900/20'
    : criticalCount > 0
      ? 'hover:shadow-red-100/50 dark:hover:shadow-red-900/20'
      : 'hover:shadow-amber-100/50 dark:hover:shadow-amber-900/20';

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-left rounded-2xl border-2 bg-card p-4 transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-lg cursor-pointer',
        accentBorder,
        accentGlow,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div
              className={cn(
                'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                valid
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : criticalCount > 0
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-amber-100 dark:bg-amber-900/30',
              )}
            >
              {valid ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : criticalCount > 0 ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <p className="font-bold text-sm truncate">
              {filing.houseBol || filing.masterBol || filing.id.slice(0, 10)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground truncate pl-9">
            {filing.importerName || 'Unknown importer'}
          </p>
        </div>
        <ScoreRing score={score} />
      </div>

      <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground">
        <StatusBadge status={filing.status as ShipmentStatus} />
        {commodity.countryOfOrigin && (
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" /> {commodity.countryOfOrigin}
          </span>
        )}
        {filing.filingType && (
          <span className="font-medium">{filing.filingType}</span>
        )}
      </div>

      {!valid && (
        <div className="flex items-center gap-1.5 mt-3">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
              <AlertCircle className="h-2.5 w-2.5" /> {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              <AlertTriangle className="h-2.5 w-2.5" /> {warningCount}
            </span>
          )}
          {infoCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
              <Info className="h-2.5 w-2.5" /> {infoCount}
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            View details <ArrowUpRight className="h-2.5 w-2.5" />
          </span>
        </div>
      )}

      {valid && (
        <div className="flex items-center gap-1.5 mt-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" /> All clear
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            View details <ArrowUpRight className="h-2.5 w-2.5" />
          </span>
        </div>
      )}
    </button>
  );
}

// ─── Filing Detail Modal ───────────────────────────────────

function FilingDetailModal({
  validation,
  open,
  onClose,
}: {
  validation: FilingValidation | null;
  open: boolean;
  onClose: () => void;
}) {
  const [expandedSeverities, setExpandedSeverities] = useState<Set<Severity>>(
    new Set(['critical', 'warning']),
  );

  const toggleSeverity = (s: Severity) => {
    setExpandedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  if (!validation) return null;

  const { filing, score, criticalCount, warningCount, infoCount, valid, errors } = validation;
  const commodity = getFirstCommodity(filing);

  const grouped: Record<Severity, ValidationError[]> = { critical: [], warning: [], info: [] };
  errors.forEach((e) => grouped[e.severity].push(e));

  const fieldCategories: Record<string, string> = {
    importerName: 'Parties', importerNumber: 'Parties', consigneeName: 'Parties',
    consigneeNumber: 'Parties', manufacturer: 'Parties', seller: 'Parties',
    buyer: 'Parties', shipToParty: 'Parties', containerStuffingLocation: 'Parties',
    consolidator: 'Parties', masterBol: 'Shipment', houseBol: 'Shipment',
    scacCode: 'Shipment', vesselName: 'Shipment', voyageNumber: 'Shipment',
    foreignPortOfUnlading: 'Shipment', placeOfDelivery: 'Shipment',
    estimatedDeparture: 'Dates', estimatedArrival: 'Dates', filingDeadline: 'Dates',
    htsCode: 'Commodity', countryOfOrigin: 'Commodity', description: 'Commodity',
    containerNumber: 'Container', containerType: 'Container',
    bondType: 'Bond', bondSuretyCode: 'Bond',
  };

  const getCategory = (field: string): string => {
    for (const [key, cat] of Object.entries(fieldCategories)) {
      if (field.toLowerCase().includes(key.toLowerCase())) return cat;
    }
    return 'Other';
  };

  const aiSuggestions: { icon: typeof Lightbulb; text: string; priority: 'high' | 'medium' | 'low' }[] = [];

  if (criticalCount > 0) {
    const missingParties = errors.filter(
      (e) => e.severity === 'critical' && getCategory(e.field) === 'Parties',
    );
    if (missingParties.length > 0) {
      aiSuggestions.push({
        icon: Users,
        text: missingParties.length + ' party field(s) are missing or incomplete. CBP requires all 10 ISF parties for ISF-10 filings.',
        priority: 'high',
      });
    }
    const missingShipment = errors.filter(
      (e) => e.severity === 'critical' && getCategory(e.field) === 'Shipment',
    );
    if (missingShipment.length > 0) {
      aiSuggestions.push({
        icon: Ship,
        text: 'Key shipment identifiers are missing (' + missingShipment.map((e) => e.field).join(', ') + '). Required for CBP processing.',
        priority: 'high',
      });
    }
    const missingCommodity = errors.filter(
      (e) => e.severity === 'critical' && getCategory(e.field) === 'Commodity',
    );
    if (missingCommodity.length > 0) {
      aiSuggestions.push({
        icon: Package,
        text: 'Commodity information is incomplete. Ensure HTS code is at least 6 digits and country of origin is a valid ISO code.',
        priority: 'high',
      });
    }
  }

  if (warningCount > 0) {
    aiSuggestions.push({
      icon: Lightbulb,
      text: warningCount + ' non-critical issue(s) found. Fixing them improves data quality and reduces CBP holds.',
      priority: 'medium',
    });
  }

  if (valid && score < 100) {
    aiSuggestions.push({
      icon: TrendingUp,
      text: 'Filing passes validation (score: ' + score + '/100). Consider filling optional fields.',
      priority: 'low',
    });
  }

  if (valid && score === 100) {
    aiSuggestions.push({
      icon: Zap,
      text: 'Fully compliant with CBP requirements. Ready for submission.',
      priority: 'low',
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <div
          className={cn(
            'px-6 py-5 border-b',
            valid
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
              : criticalCount > 0
                ? 'bg-red-50/50 dark:bg-red-950/20'
                : 'bg-amber-50/50 dark:bg-amber-950/20',
          )}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  {filing.houseBol || filing.masterBol || filing.id.slice(0, 12)}
                </DialogTitle>
                <DialogDescription className="mt-1 flex items-center gap-2 flex-wrap">
                  <span>{filing.importerName || 'Unknown importer'}</span>
                  <span className="text-muted-foreground/50">&middot;</span>
                  <StatusBadge status={filing.status as ShipmentStatus} />
                  <span className="text-muted-foreground/50">&middot;</span>
                  <span>{filing.filingType}</span>
                  {commodity.countryOfOrigin && (
                    <>
                      <span className="text-muted-foreground/50">&middot;</span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {commodity.countryOfOrigin}
                      </span>
                    </>
                  )}
                </DialogDescription>
              </div>
              <ScoreRing score={score} size={64} strokeWidth={5} />
            </div>
          </DialogHeader>

          <div className="flex items-center gap-3 mt-4">
            {criticalCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                <AlertCircle className="h-3 w-3" /> {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> {warningCount} Warning{warningCount > 1 ? 's' : ''}
              </span>
            )}
            {infoCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                <Info className="h-3 w-3" /> {infoCount} Info
              </span>
            )}
            {valid && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> All Clear
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[calc(85vh-220px)]">
          <div className="px-6 py-5 space-y-5">
            {/* AI Suggestions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className="text-sm font-semibold">AI Compliance Insights</h3>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400"
                >
                  Beta
                </Badge>
              </div>
              <div className="space-y-2">
                {aiSuggestions.map((suggestion, i) => {
                  const SuggIcon = suggestion.icon;
                  const priorityColors: Record<string, string> = {
                    high: 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10',
                    medium: 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10',
                    low: 'border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10',
                  };
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border-l-[3px] transition-colors',
                        priorityColors[suggestion.priority],
                      )}
                    >
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <SuggIcon className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {errors.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Validation Issues ({errors.length})
                </h3>
                {(['critical', 'warning', 'info'] as Severity[]).map((severity) => {
                  const items = grouped[severity];
                  if (items.length === 0) return null;
                  const config = severityConfig[severity];
                  const SevIcon = config.icon;
                  const isExpanded = expandedSeverities.has(severity);
                  return (
                    <div key={severity} className={cn('rounded-xl border overflow-hidden', config.border)}>
                      <button
                        onClick={() => toggleSeverity(severity)}
                        className={cn('w-full flex items-center gap-3 p-3 text-left transition-colors', config.bgLight)}
                      >
                        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', config.bgDark)}>
                          <SevIcon className={cn('h-3.5 w-3.5', config.color)} />
                        </div>
                        <div className="flex-1">
                          <span className={cn('text-sm font-semibold', config.text)}>{config.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">({items.length} issue{items.length > 1 ? 's' : ''})</span>
                        </div>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <div className="border-t divide-y" style={{ borderColor: 'inherit' }}>
                          {items.map((err, j) => (
                            <div key={j} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                              <div className="mt-0.5 shrink-0">
                                <Badge variant="outline" className="text-[10px] font-mono px-1.5">{err.field}</Badge>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground">{err.message}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{err.code}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="font-semibold text-foreground">Fully Compliant</p>
                <p className="text-sm text-muted-foreground mt-1">This filing passes all CBP validation checks.</p>
              </div>
            )}

            <Separator />

            {/* Filing Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                Filing Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Master BOL', value: filing.masterBol },
                  { label: 'House BOL', value: filing.houseBol },
                  { label: 'Importer', value: filing.importerName },
                  { label: 'Consignee', value: filing.consigneeName },
                  { label: 'Manufacturer', value: getPartyName(filing.manufacturer) },
                  { label: 'Seller', value: getPartyName(filing.seller) },
                  { label: 'Vessel', value: filing.vesselName },
                  { label: 'SCAC', value: filing.scacCode },
                  { label: 'HTS Code', value: commodity.htsCode },
                  { label: 'Origin', value: commodity.countryOfOrigin },
                  { label: 'Departure', value: filing.estimatedDeparture ? new Date(filing.estimatedDeparture).toLocaleDateString() : null },
                  { label: 'Arrival', value: filing.estimatedArrival ? new Date(filing.estimatedArrival).toLocaleDateString() : null },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-xs gap-2 px-3 py-2 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="font-medium text-right truncate">
                      {value || <span className="text-muted-foreground/50 italic">&mdash;</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t px-6 py-3 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {filing.createdAt
              ? 'Created ' + new Date(filing.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Created ---'}
          </div>
          <div className="flex items-center gap-2">
            {(filing.status === 'draft' || filing.status === 'rejected') && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                <Link to={'/shipments/' + filing.id + '/edit'}>
                  <Zap className="h-3 w-3" /> Fix Issues
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
              <Link to={'/shipments/' + filing.id}>
                <ExternalLink className="h-3 w-3" /> View Filing
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export default function CompliancePage() {
  const { data: filingsData, isLoading: filingsLoading } = useFilings({ limit: 200 });
  const filings = filingsData?.data ?? [];

  const [validations, setValidations] = useState<FilingValidation[]>([]);
  const [validating, setValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedFiling, setSelectedFiling] = useState<FilingValidation | null>(null);

  useEffect(() => {
    if (filings.length === 0) return;
    let cancelled = false;

    const run = async () => {
      setValidating(true);
      setValidationProgress(0);
      const results: FilingValidation[] = [];
      const toValidate = filings.filter((f) => f.status !== 'cancelled');
      const total = toValidate.length;

      for (let i = 0; i < total; i += 5) {
        if (cancelled) return;
        const batch = toValidate.slice(i, i + 5);
        const batchResults = await Promise.allSettled(
          batch.map(async (f) => {
            try {
              const result = await filingsApi.validate(f.id);
              return {
                filingId: f.id,
                filing: f,
                valid: result.valid,
                score: result.score,
                criticalCount: result.criticalCount,
                warningCount: result.warningCount,
                infoCount: result.infoCount,
                errors: result.errors as ValidationError[],
              } as FilingValidation;
            } catch {
              return null;
            }
          }),
        );
        batchResults.forEach((r) => {
          if (r.status === 'fulfilled' && r.value) results.push(r.value);
        });
        if (!cancelled) {
          setValidationProgress(Math.min(100, Math.round(((i + batch.length) / total) * 100)));
        }
      }

      if (!cancelled) {
        setValidations(results);
        setValidating(false);
        setValidationProgress(100);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [filings]);

  const stats = useMemo(() => {
    const total = validations.length;
    const clean = validations.filter((v) => v.valid).length;
    const withIssues = total - clean;
    const avgScore = total > 0 ? Math.round(validations.reduce((s, v) => s + v.score, 0) / total) : 100;
    const complianceRate = total > 0 ? Math.round((clean / total) * 100) : 100;
    const totalCritical = validations.reduce((s, v) => s + v.criticalCount, 0);
    const totalWarning = validations.reduce((s, v) => s + v.warningCount, 0);
    const totalInfo = validations.reduce((s, v) => s + v.infoCount, 0);
    return { total, clean, withIssues, avgScore, complianceRate, totalCritical, totalWarning, totalInfo };
  }, [validations]);

  const filtered = useMemo(() => {
    let result = validations;
    if (filterMode === 'issues') result = result.filter((v) => !v.valid);
    else if (filterMode === 'clean') result = result.filter((v) => v.valid);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.filing.id.toLowerCase().includes(q) ||
          (v.filing.importerName || '').toLowerCase().includes(q) ||
          (v.filing.masterBol || '').toLowerCase().includes(q) ||
          (v.filing.houseBol || '').toLowerCase().includes(q) ||
          v.errors.some((e) => e.field.toLowerCase().includes(q) || e.message.toLowerCase().includes(q)),
      );
    }

    result = [...result].sort((a, b) => {
      if (a.valid !== b.valid) return a.valid ? 1 : -1;
      if (a.criticalCount !== b.criticalCount) return b.criticalCount - a.criticalCount;
      return a.score - b.score;
    });

    return result;
  }, [validations, filterMode, search]);

  if (filingsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            Compliance Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">CBP validation health across all ISF filings</p>
        </div>
        {validating && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <div className="w-32"><Progress value={validationProgress} className="h-1.5" /></div>
            <span className="tabular-nums text-xs">{validationProgress}%</span>
          </div>
        )}
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}>
        <Card className="border-2 border-primary/20 hover:border-primary/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <ScoreRing score={stats.complianceRate} size={48} strokeWidth={4} />
            <div>
              <p className="text-xs text-muted-foreground">Pass Rate</p>
              <p className="text-xl font-black tabular-nums">{stats.complianceRate}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn('border-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md', stats.avgScore >= 85 ? 'border-emerald-200/60 hover:border-emerald-300' : stats.avgScore >= 60 ? 'border-amber-200/60 hover:border-amber-300' : 'border-red-200/60 hover:border-red-300')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', stats.avgScore >= 85 ? 'bg-emerald-100 dark:bg-emerald-900/30' : stats.avgScore >= 60 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
              <BarChart3 className={cn('h-5 w-5', stats.avgScore >= 85 ? 'text-emerald-600' : stats.avgScore >= 60 ? 'text-amber-600' : 'text-red-600')} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Score</p>
              <p className="text-xl font-black tabular-nums">{stats.avgScore}</p>
            </div>
          </CardContent>
        </Card>

        <button onClick={() => setFilterMode((f) => (f === 'issues' ? 'all' : 'issues'))} className={cn('rounded-xl border-2 bg-card p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md', 'border-red-200/60 hover:border-red-300 dark:border-red-900/40', filterMode === 'issues' && 'ring-2 ring-red-400/30')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium">Critical</span>
            </div>
            <span className="text-xl font-black tabular-nums text-red-600 dark:text-red-400">{stats.totalCritical}</span>
          </div>
        </button>

        <button onClick={() => setFilterMode((f) => (f === 'issues' ? 'all' : 'issues'))} className={cn('rounded-xl border-2 bg-card p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md', 'border-amber-200/60 hover:border-amber-300 dark:border-amber-900/40')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium">Warnings</span>
            </div>
            <span className="text-xl font-black tabular-nums text-amber-600 dark:text-amber-400">{stats.totalWarning}</span>
          </div>
        </button>

        <button onClick={() => setFilterMode((f) => (f === 'clean' ? 'all' : 'clean'))} className={cn('rounded-xl border-2 bg-card p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md', 'border-emerald-200/60 hover:border-emerald-300 dark:border-emerald-900/40', filterMode === 'clean' && 'ring-2 ring-emerald-400/30')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium">Clean</span>
            </div>
            <span className="text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{stats.clean}</span>
          </div>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}>
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search BOL, importer, or issue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-transparent focus:bg-card focus:border-input transition-all duration-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg p-1">
          {([
            { key: 'all' as FilterMode, label: 'All', count: stats.total },
            { key: 'issues' as FilterMode, label: 'Issues', count: stats.withIssues },
            { key: 'clean' as FilterMode, label: 'Clean', count: stats.clean },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterMode(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                filterMode === tab.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <span className={cn('ml-1.5 tabular-nums', filterMode === tab.key ? 'text-foreground' : 'text-muted-foreground/60')}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground ml-auto">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> filing{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filing Cards Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v, i) => (
            <div
              key={v.filingId}
              className="opacity-0 animate-fade-in-up"
              style={{ animationDelay: (200 + i * 40) + 'ms', animationFillMode: 'forwards' }}
            >
              <FilingCard validation={v} onClick={() => setSelectedFiling(v)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            {search ? <Search className="h-6 w-6 text-muted-foreground" /> : filterMode === 'clean' ? <AlertTriangle className="h-6 w-6 text-muted-foreground" /> : <CheckCircle2 className="h-6 w-6 text-muted-foreground" />}
          </div>
          <p className="font-semibold text-foreground text-lg">
            {search ? 'No matching filings' : filterMode === 'clean' ? 'No clean filings yet' : filterMode === 'issues' ? 'No filings with issues' : 'No filings found'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? 'Try adjusting your search' : 'Create a new ISF filing to get started'}
          </p>
          {(search || filterMode !== 'all') && (
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterMode('all'); }} className="mt-3">
              Clear filters
            </Button>
          )}
        </div>
      )}

      <FilingDetailModal validation={selectedFiling} open={!!selectedFiling} onClose={() => setSelectedFiling(null)} />
    </div>
  );
}
