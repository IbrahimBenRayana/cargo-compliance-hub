import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useFiling, useCreateFiling, useUpdateFiling } from '@/hooks/useFilings';
import { useManifestQuery } from '@/hooks/useManifestQuery';
import type { PartyInfo, CommodityInfo, ContainerInfo } from '@/types/shipment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, ArrowRight, Check, ChevronsUpDown, Loader2, Info, Ship, Package, Users, FileText,
  Building2, MapPin, Plus, Trash2, AlertCircle, CheckCircle2, Sparkles, Container, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { SCHEDULE_D_PORTS, CBP_PORTS_4DIGIT } from '@/data/schedule-d-ports';
import { HTSAutocomplete } from '@/components/HTSAutocomplete';

// ─── Reference Data for Dropdowns ──────────────────────────

const BOND_TYPES = [
  { value: 'continuous', label: '8 — Continuous Bond' },
  { value: 'single', label: '9 — Single Transaction Bond' },
];

const CONTAINER_TYPES = [
  { value: 'CN', label: 'CN — Container' },
  { value: 'NC', label: 'NC — No Container' },
  { value: '20', label: '20 — 20ft Standard' },
  { value: '40', label: '40 — 40ft Standard' },
  { value: '40H', label: '40H — 40ft High Cube' },
  { value: '45', label: '45 — 45ft High Cube' },
];

const WEIGHT_UOMS = [
  { value: 'K', label: 'KG — Kilograms' },
  { value: 'L', label: 'LBS — Pounds' },
];

const QUANTITY_UOMS = [
  { value: 'PKG', label: 'PKG — Packages' },
  { value: 'PCS', label: 'PCS — Pieces' },
  { value: 'CTN', label: 'CTN — Cartons' },
  { value: 'PLT', label: 'PLT — Pallets' },
  { value: 'BX', label: 'BX — Boxes' },
  { value: 'EA', label: 'EA — Each' },
];

const COMMON_COUNTRIES = [
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'CN', label: '🇨🇳 China' },
  { value: 'IN', label: '🇮🇳 India' },
  { value: 'DE', label: '🇩🇪 Germany' },
  { value: 'JP', label: '🇯🇵 Japan' },
  { value: 'KR', label: '🇰🇷 South Korea' },
  { value: 'TW', label: '🇹🇼 Taiwan' },
  { value: 'VN', label: '🇻🇳 Vietnam' },
  { value: 'TH', label: '🇹🇭 Thailand' },
  { value: 'MX', label: '🇲🇽 Mexico' },
  { value: 'CA', label: '🇨🇦 Canada' },
  { value: 'GB', label: '🇬🇧 United Kingdom' },
  { value: 'FR', label: '🇫🇷 France' },
  { value: 'IT', label: '🇮🇹 Italy' },
  { value: 'BR', label: '🇧🇷 Brazil' },
  { value: 'BD', label: '🇧🇩 Bangladesh' },
  { value: 'ID', label: '🇮🇩 Indonesia' },
  { value: 'PK', label: '🇵🇰 Pakistan' },
  { value: 'TR', label: '🇹🇷 Turkey' },
  { value: 'MY', label: '🇲🇾 Malaysia' },
  { value: 'SG', label: '🇸🇬 Singapore' },
  { value: 'HK', label: '🇭🇰 Hong Kong' },
  { value: 'AE', label: '🇦🇪 UAE' },
  { value: 'NL', label: '🇳🇱 Netherlands' },
  { value: 'ES', label: '🇪🇸 Spain' },
  { value: 'AU', label: '🇦🇺 Australia' },
  { value: 'PH', label: '🇵🇭 Philippines' },
];

// ─── Wizard Step Definitions ───────────────────────────────

const STEPS_ISF10 = [
  { id: 'filing',    label: 'Filing Info',      icon: FileText,  desc: 'ISF type, BOL numbers & bond info' },
  { id: 'importer',  label: 'IOR & Consignee',  icon: Building2, desc: 'Importer of Record & consignee details' },
  { id: 'parties',   label: 'Trade Parties',     icon: Users,     desc: 'Buyer, seller, ship-to & manufacturer' },
  { id: 'transport', label: 'Transport',         icon: Ship,      desc: 'Vessel, voyage & port information' },
  { id: 'cargo',     label: 'Cargo',             icon: Package,   desc: 'Commodities, HTS & containers' },
  { id: 'review',    label: 'Review & Submit',   icon: Check,     desc: 'Final review before submission' },
];

const STEPS_ISF5 = [
  { id: 'filing',    label: 'Filing Info',          icon: FileText,  desc: 'ISF-5 type, BOL numbers & bond info' },
  { id: 'filer',     label: 'Filer & Booking Party', icon: Building2, desc: 'ISF Filer (carrier/NVOCC) & booking party' },
  { id: 'parties',   label: 'Ship-To & Manufacturer', icon: Users,   desc: 'Ship-to party & manufacturer details' },
  { id: 'cargo',     label: 'Cargo',                 icon: Package,  desc: 'Commodities, HTS & containers' },
  { id: 'review',    label: 'Review & Submit',       icon: Check,    desc: 'Final review before submission' },
];

// ─── Types ─────────────────────────────────────────────────

interface PartyFormData {
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface CommodityFormData {
  htsCode: string;
  description: string;
  countryOfOrigin: string;
  quantity: string;
  quantityUOM: string;
  weight: string;
  weightUOM: string;
}

interface ContainerFormData {
  number: string;
  type: string;
}

interface ISFFormState {
  // Filing Identity
  filingType: 'ISF-10' | 'ISF-5';
  masterBol: string;
  houseBol: string;
  bondType: string;

  // IOR & Filer
  importerName: string;
  importerNumber: string;

  // Consignee
  consigneeName: string;
  consigneeNumber: string;
  consigneeAddress: PartyFormData;

  // Trade Parties
  buyer: PartyFormData;
  seller: PartyFormData;
  shipToParty: PartyFormData;
  manufacturer: PartyFormData;
  consolidator: PartyFormData;
  containerStuffingLocation: PartyFormData;

  // Transport
  scacCode: string;
  vesselName: string;
  voyageNumber: string;
  foreignPortOfUnlading: string;
  estimatedDeparture: string;
  estimatedArrival: string;

  // Cargo
  commodities: CommodityFormData[];
  containers: ContainerFormData[];

  // ISF-5 Specific
  isf5: {
    bookingPartyName: string;
    bookingPartyTaxID: string;
    bookingPartyIdentifierCode: string;
    bookingPartyAddress1: string;
    bookingPartyAddress2: string;
    bookingPartyCity: string;
    bookingPartyStateOrProvince: string;
    bookingPartyPostalCode: string;
    bookingPartyCountry: string;
    ISFFilerName: string;
    ISFFilerLastName: string;
    ISFFilerIDCodeQualifier: string;
    ISFFilerNumber: string;
    ISFShipmentTypeCode: string;
    bondActivityCode: string;
    bondHolderID: string;
    USPortOfArrival: string;
  };
}

const emptyParty = (): PartyFormData => ({ name: '', address1: '', address2: '', city: '', state: '', zip: '', country: '' });
const emptyCommodity = (): CommodityFormData => ({ htsCode: '', description: '', countryOfOrigin: '', quantity: '', quantityUOM: 'PKG', weight: '', weightUOM: 'K' });
const emptyContainer = (): ContainerFormData => ({ number: '', type: 'CN' });

const emptyISF5 = () => ({
  bookingPartyName: '', bookingPartyTaxID: '', bookingPartyIdentifierCode: '',
  bookingPartyAddress1: '', bookingPartyAddress2: '', bookingPartyCity: '',
  bookingPartyStateOrProvince: '', bookingPartyPostalCode: '', bookingPartyCountry: '',
  ISFFilerName: '', ISFFilerLastName: '', ISFFilerIDCodeQualifier: '24', ISFFilerNumber: '',
  ISFShipmentTypeCode: '01', bondActivityCode: '01', bondHolderID: '', USPortOfArrival: '',
});

const initialForm = (): ISFFormState => ({
  filingType: 'ISF-10',
  masterBol: '',
  houseBol: '',
  bondType: 'continuous',
  importerName: '',
  importerNumber: '',
  consigneeName: '',
  consigneeNumber: '',
  consigneeAddress: emptyParty(),
  buyer: emptyParty(),
  seller: emptyParty(),
  shipToParty: emptyParty(),
  manufacturer: emptyParty(),
  consolidator: emptyParty(),
  containerStuffingLocation: emptyParty(),
  scacCode: '',
  vesselName: '',
  voyageNumber: '',
  foreignPortOfUnlading: '',
  estimatedDeparture: '',
  estimatedArrival: '',
  commodities: [emptyCommodity()],
  containers: [emptyContainer()],
  isf5: emptyISF5(),
});

// ─── Reusable Field Components ─────────────────────────────

const HintLabel = memo(function HintLabel({ label, hint, required }: { label: string; hint?: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-sm font-medium">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      {hint && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">{hint}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
});

const TextField = memo(function TextField({
  label, hint, required, placeholder, value, onChange, maxLength, pattern, error, className: cls,
}: {
  label: string; hint?: string; required?: boolean; placeholder?: string;
  value: string; onChange: (v: string) => void; maxLength?: number; pattern?: string;
  error?: string; className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        pattern={pattern}
        className={cn(error && 'border-red-500 focus-visible:ring-red-500')}
      />
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
      {maxLength && value.length > maxLength * 0.8 && !error && (
        <p className="text-xs text-muted-foreground text-right">{value.length}/{maxLength}</p>
      )}
    </div>
  );
});

const SelectField = memo(function SelectField({
  label, hint, required, value, onChange, options, placeholder, error, className: cls,
}: {
  label: string; hint?: string; required?: boolean;
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; error?: string; className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn(error && 'border-red-500')}>
          <SelectValue placeholder={placeholder || 'Select...'} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
});

// ─── Searchable Port Combobox ──────────────────────────────

const PortSelectField = memo(function PortSelectField({
  label, hint, required, value, onChange, options, placeholder, error, className: cls,
}: {
  label: string; hint?: string; required?: boolean;
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; error?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <div className={cn('space-y-1.5', cls)}>
      <HintLabel label={label} hint={hint} required={required} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open}
            className={cn('w-full justify-between font-normal h-9 px-3', !selected && 'text-muted-foreground', error && 'border-red-500')}>
            <span className="truncate">{selected ? selected.label : (placeholder || 'Select port…')}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by code or city…" />
            <CommandList className="max-h-[280px]">
              <CommandEmpty>No port found.</CommandEmpty>
              <CommandGroup>
                {options.map(o => (
                  <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }}>
                    <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
});

// ─── Party Card Component ──────────────────────────────────

const PartyCard = memo(function PartyCard({
  title, icon: Icon, party, onChange, showTaxId, taxIdLabel, taxIdHint, nameMaxLen = 35,
}: {
  title: string; icon: React.ElementType; party: PartyFormData;
  onChange: (p: PartyFormData) => void; showTaxId?: boolean;
  taxIdLabel?: string; taxIdHint?: string; nameMaxLen?: number;
}) {
  const up = (field: keyof PartyFormData, val: string) => onChange({ ...party, [field]: val });
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <TextField label="Company / Name" required value={party.name} onChange={v => up('name', v)}
          maxLength={nameMaxLen} placeholder="Letters, numbers, spaces, dashes only"
          hint={`Max ${nameMaxLen} chars. No periods or special characters.`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Address Line 1" required value={party.address1} onChange={v => up('address1', v)}
            maxLength={35} placeholder="Street address" hint="Max 35 characters" />
          <TextField label="Address Line 2" value={party.address2} onChange={v => up('address2', v)}
            maxLength={35} placeholder="Suite, unit, floor" hint="Optional. Don't use a single period." />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TextField label="City" required value={party.city} onChange={v => up('city', v)}
            placeholder="City" maxLength={35} />
          <TextField label="State" value={party.state} onChange={v => up('state', v)}
            placeholder="ST" maxLength={4} />
          <TextField label="Postal Code" value={party.zip} onChange={v => up('zip', v)}
            placeholder="00000" maxLength={10} />
          <SelectField label="Country" required value={party.country} onChange={v => up('country', v)}
            options={COMMON_COUNTRIES} placeholder="Select" />
        </div>
      </CardContent>
    </Card>
  );
});

// ─── Progress Calculation ──────────────────────────────────

function calcProgress(form: ISFFormState): number {
  let filled = 0;
  let total = 0;
  const check = (v: string, weight = 1) => { total += weight; if (v.trim()) filled += weight; };
  // Filing
  check(form.masterBol, 2); check(form.houseBol, 2); check(form.bondType);
  // IOR
  check(form.importerName, 2); check(form.importerNumber, 2);
  // Consignee
  check(form.consigneeName, 2); check(form.consigneeNumber);
  check(form.consigneeAddress.address1); check(form.consigneeAddress.city); check(form.consigneeAddress.country);
  // Parties
  for (const p of [form.buyer, form.seller, form.shipToParty, form.manufacturer, form.consolidator, form.containerStuffingLocation]) {
    check(p.name, 2); check(p.address1); check(p.city); check(p.country);
  }
  // Transport
  check(form.scacCode, 2); check(form.vesselName, 2); check(form.voyageNumber);
  check(form.foreignPortOfUnlading); check(form.estimatedArrival, 2);
  // Cargo
  if (form.commodities.length > 0) {
    const c = form.commodities[0];
    check(c.htsCode, 2); check(c.description); check(c.countryOfOrigin, 2);
  }
  if (form.containers.length > 0) { check(form.containers[0].number); }
  return Math.round((filled / total) * 100);
}

// ─── Main Component ────────────────────────────────────────

export default function ShipmentWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEdit = !!id;

  const { data: existing, isLoading: isLoadingFiling } = useFiling(id);
  const createFiling = useCreateFiling();
  const updateFiling = useUpdateFiling();

  // Filing→Filing prefill chain. If `?fromFiling=<id>` is set on a NEW
  // wizard (not edit), we fetch that filing and hydrate the form from it,
  // blanking identity fields (BOL, voyage, containers, dates) so the user
  // must supply per-shipment values. Banner stays visible until cleared.
  const fromFilingId = searchParams.get('fromFiling') ?? undefined;
  const { data: sourceFiling } = useFiling(!isEdit ? fromFilingId : undefined);

  // Manifest→ISF prefill chain. If `?fromManifestQuery=<id>` is set on a
  // NEW wizard, we fetch that manifest query and pull the small set of
  // fields CC's response carries (mBOL, hBOL, carrier, port of unlading,
  // arrival date). Most ISF fields still need entry; the banner says so.
  const fromManifestQueryId = searchParams.get('fromManifestQuery') ?? undefined;
  const { data: sourceManifestQuery } = useManifestQuery(!isEdit ? fromManifestQueryId : undefined);

  const [sourceProvenance, setSourceProvenance] = useState<{
    kind: 'filing' | 'manifest';
    label: string;
    url: string;
    createdAt: string;
  } | null>(null);

  // Persist step in URL so browser back-button works (?step=0..N)
  const stepParam = parseInt(searchParams.get('step') ?? '0', 10);
  const step = Number.isNaN(stepParam) || stepParam < 0 ? 0 : stepParam;
  const setStep = (n: number) => setSearchParams(p => { p.set('step', String(n)); return p; }, { replace: true });
  const [form, setForm] = useState<ISFFormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic steps based on filing type
  const STEPS = form.filingType === 'ISF-5' ? STEPS_ISF5 : STEPS_ISF10;

  // Parse a party from DB (could be JSON string, object, or plain string)
  const parseParty = useCallback((raw: any): PartyFormData => {
    if (!raw) return emptyParty();
    let obj = raw;
    if (typeof raw === 'string') {
      try { obj = JSON.parse(raw); } catch { return { ...emptyParty(), name: raw }; }
    }
    if (Array.isArray(obj)) obj = obj[0] || {};
    return {
      name: obj.name || '',
      address1: obj.address1 || obj.street || '',
      address2: obj.address2 || '',
      city: obj.city || '',
      state: obj.state || obj.stateOrProvince || '',
      zip: obj.zip || obj.postalCode || '',
      country: obj.country || '',
    };
  }, []);

  // Filing→Filing prefill: hydrate form from a source filing. Identity
  // fields are intentionally blanked (BOL, voyage, containers, dates) —
  // those must be unique per shipment, so we make the user fill them in.
  useEffect(() => {
    if (isEdit) return; // editing path uses the other useEffect below
    if (!sourceFiling) return;
    const c0 = sourceFiling.commodities?.[0];
    setForm({
      filingType: sourceFiling.filingType || 'ISF-10',
      // Identity fields blanked — user must supply per-shipment values.
      masterBol: '',
      houseBol: '',
      voyageNumber: '',
      estimatedDeparture: '',
      estimatedArrival: '',
      // Carry over reusable bond + party info.
      bondType: sourceFiling.bondType || 'continuous',
      importerName: sourceFiling.importerName || '',
      importerNumber: sourceFiling.importerNumber || '',
      consigneeName: sourceFiling.consigneeName || '',
      consigneeNumber: sourceFiling.consigneeNumber || '',
      consigneeAddress: parseParty(sourceFiling.consigneeAddress),
      buyer: parseParty(sourceFiling.buyer),
      seller: parseParty(sourceFiling.seller),
      shipToParty: parseParty(sourceFiling.shipToParty),
      manufacturer: parseParty(Array.isArray(sourceFiling.manufacturer) ? sourceFiling.manufacturer[0] : sourceFiling.manufacturer),
      consolidator: parseParty(sourceFiling.consolidator),
      containerStuffingLocation: parseParty(sourceFiling.containerStuffingLocation),
      scacCode: sourceFiling.scacCode || '',
      vesselName: sourceFiling.vesselName || '',
      foreignPortOfUnlading: sourceFiling.foreignPortOfUnlading || '',
      commodities: c0 ? [{
        htsCode: c0.htsCode || '',
        description: c0.description || '',
        countryOfOrigin: c0.countryOfOrigin || '',
        quantity: c0.quantity != null ? String(c0.quantity) : '',
        quantityUOM: c0.quantityUOM || c0.weight?.unit === 'L' ? 'PCS' : 'PKG',
        weight: c0.weight?.value != null ? String(c0.weight.value) : '',
        weightUOM: c0.weight?.unit || 'K',
      }] : [emptyCommodity()],
      // Containers blanked — different per shipment.
      containers: [emptyContainer()],
      isf5: sourceFiling.isf5Data ? {
        bookingPartyName: sourceFiling.isf5Data.bookingPartyName || '',
        bookingPartyTaxID: sourceFiling.isf5Data.bookingPartyTaxID || '',
        bookingPartyIdentifierCode: sourceFiling.isf5Data.bookingPartyIdentifierCode || '',
        bookingPartyAddress1: sourceFiling.isf5Data.bookingPartyAddress1 || '',
        bookingPartyAddress2: sourceFiling.isf5Data.bookingPartyAddress2 || '',
        bookingPartyCity: sourceFiling.isf5Data.bookingPartyCity || '',
        bookingPartyStateOrProvince: sourceFiling.isf5Data.bookingPartyStateOrProvince || '',
        bookingPartyPostalCode: sourceFiling.isf5Data.bookingPartyPostalCode || '',
        bookingPartyCountry: sourceFiling.isf5Data.bookingPartyCountry || '',
        ISFFilerName: sourceFiling.isf5Data.ISFFilerName || '',
        ISFFilerLastName: sourceFiling.isf5Data.ISFFilerLastName || '',
        ISFFilerIDCodeQualifier: sourceFiling.isf5Data.ISFFilerIDCodeQualifier || '24',
        ISFFilerNumber: sourceFiling.isf5Data.ISFFilerNumber || '',
        ISFShipmentTypeCode: sourceFiling.isf5Data.ISFShipmentTypeCode || '01',
        bondActivityCode: sourceFiling.isf5Data.bondActivityCode || '01',
        bondHolderID: sourceFiling.isf5Data.bondHolderID || '',
        USPortOfArrival: sourceFiling.isf5Data.USPortOfArrival || '',
      } : emptyISF5(),
    });
    setSourceProvenance({
      kind:      'filing',
      label:     sourceFiling.masterBol || sourceFiling.houseBol || sourceFiling.id.slice(0, 8).toUpperCase(),
      url:       `/shipments/${sourceFiling.id}`,
      createdAt: sourceFiling.createdAt,
    });
  }, [sourceFiling, isEdit, parseParty]);

  // Manifest→ISF prefill: hydrate the BOL / carrier / port / arrival
  // fields. Everything else (importer, parties, bond, vessel, voyage,
  // commodities) stays empty — the banner copy is explicit about that.
  useEffect(() => {
    if (isEdit) return;
    const mq = (sourceManifestQuery as any)?.data ?? sourceManifestQuery;
    if (!mq) return;
    const resp = mq.response;
    const raw = resp?.data?.response;
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return;

    const firstHouse = Array.isArray(item.houses) ? item.houses[0] : undefined;
    const masterBol: string = item.masterBOLNumber ?? resp?.data?.masterBOLNumber ?? item.awbNumber ?? '';
    const houseBol:  string = firstHouse?.hawbNumber ?? firstHouse?.awbNumber ?? '';
    const carrierCode: string = item.carrierCode ?? item.importingCarrierCode ?? '';
    const port: string = item.manifestedPortOfUnlading ?? firstHouse?.manifestedPort ?? item.actualPortOcean ?? '';
    // CC arrival dates are YYYYMMDD; the wizard form uses ISO YYYY-MM-DD.
    const arrivalRaw: string | undefined = item.scheduledArrivalDate ?? firstHouse?.scheduledArrivalDate ?? item.wr1DateOfArrival;
    const arrivalIso = arrivalRaw && /^\d{8}$/.test(arrivalRaw)
      ? `${arrivalRaw.slice(0, 4)}-${arrivalRaw.slice(4, 6)}-${arrivalRaw.slice(6, 8)}`
      : '';

    setForm(prev => ({
      ...prev,
      masterBol: prev.masterBol || masterBol,
      houseBol:  prev.houseBol  || houseBol,
      scacCode:  prev.scacCode  || carrierCode,
      foreignPortOfUnlading: prev.foreignPortOfUnlading || port,
      estimatedArrival: prev.estimatedArrival || arrivalIso,
    }));
    setSourceProvenance({
      kind:      'manifest',
      label:     mq.bolNumber || mq.id.slice(0, 8).toUpperCase(),
      url:       `/manifest-query?id=${mq.id}`,
      createdAt: mq.createdAt,
    });
  }, [sourceManifestQuery, isEdit]);

  // Populate form when editing
  useEffect(() => {
    if (!existing) return;
    const c0 = existing.commodities?.[0];
    const ct0 = existing.containers?.[0];
    setForm({
      filingType: existing.filingType || 'ISF-10',
      masterBol: existing.masterBol || '',
      houseBol: existing.houseBol || '',
      bondType: existing.bondType || 'continuous',
      importerName: existing.importerName || '',
      importerNumber: existing.importerNumber || '',
      consigneeName: existing.consigneeName || '',
      consigneeNumber: existing.consigneeNumber || '',
      consigneeAddress: parseParty(existing.consigneeAddress),
      buyer: parseParty(existing.buyer),
      seller: parseParty(existing.seller),
      shipToParty: parseParty(existing.shipToParty),
      manufacturer: parseParty(Array.isArray(existing.manufacturer) ? existing.manufacturer[0] : existing.manufacturer),
      consolidator: parseParty(existing.consolidator),
      containerStuffingLocation: parseParty(existing.containerStuffingLocation),
      scacCode: existing.scacCode || '',
      vesselName: existing.vesselName || '',
      voyageNumber: existing.voyageNumber || '',
      foreignPortOfUnlading: existing.foreignPortOfUnlading || '',
      estimatedDeparture: existing.estimatedDeparture ? existing.estimatedDeparture.split('T')[0] : '',
      estimatedArrival: existing.estimatedArrival ? existing.estimatedArrival.split('T')[0] : '',
      commodities: c0 ? [{
        htsCode: c0.htsCode || '',
        description: c0.description || '',
        countryOfOrigin: c0.countryOfOrigin || '',
        quantity: c0.quantity != null ? String(c0.quantity) : '',
        quantityUOM: c0.quantityUOM || c0.weight?.unit === 'L' ? 'PCS' : 'PKG',
        weight: c0.weight?.value != null ? String(c0.weight.value) : '',
        weightUOM: c0.weight?.unit || 'K',
      }] : [emptyCommodity()],
      containers: ct0 ? [{ number: ct0.number || '', type: ct0.type || 'CN' }] : [emptyContainer()],
      isf5: existing.isf5Data ? {
        bookingPartyName: existing.isf5Data.bookingPartyName || '',
        bookingPartyTaxID: existing.isf5Data.bookingPartyTaxID || '',
        bookingPartyIdentifierCode: existing.isf5Data.bookingPartyIdentifierCode || '',
        bookingPartyAddress1: existing.isf5Data.bookingPartyAddress1 || '',
        bookingPartyAddress2: existing.isf5Data.bookingPartyAddress2 || '',
        bookingPartyCity: existing.isf5Data.bookingPartyCity || '',
        bookingPartyStateOrProvince: existing.isf5Data.bookingPartyStateOrProvince || '',
        bookingPartyPostalCode: existing.isf5Data.bookingPartyPostalCode || '',
        bookingPartyCountry: existing.isf5Data.bookingPartyCountry || '',
        ISFFilerName: existing.isf5Data.ISFFilerName || '',
        ISFFilerLastName: existing.isf5Data.ISFFilerLastName || '',
        ISFFilerIDCodeQualifier: existing.isf5Data.ISFFilerIDCodeQualifier || '24',
        ISFFilerNumber: existing.isf5Data.ISFFilerNumber || '',
        ISFShipmentTypeCode: existing.isf5Data.ISFShipmentTypeCode || '01',
        bondActivityCode: existing.isf5Data.bondActivityCode || '01',
        bondHolderID: existing.isf5Data.bondHolderID || '',
        USPortOfArrival: existing.isf5Data.USPortOfArrival || '',
      } : emptyISF5(),
    });
  }, [existing, parseParty]);

  // ─── Updaters ──────────────────────
  const set = useCallback(<K extends keyof ISFFormState>(field: K, value: ISFFormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    // Reset step when filing type changes to avoid invalid step index
    if (field === 'filingType') setStep(0);
  }, []);

  const setParty = useCallback((field: keyof ISFFormState, party: PartyFormData) => {
    setForm(prev => ({ ...prev, [field]: party }));
  }, []);

  const setISF5 = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, isf5: { ...prev.isf5, [field]: value } }));
  }, []);

  const setCommodity = useCallback((idx: number, data: CommodityFormData) => {
    setForm(prev => {
      const arr = [...prev.commodities];
      arr[idx] = data;
      return { ...prev, commodities: arr };
    });
  }, []);

  const setContainer = useCallback((idx: number, data: ContainerFormData) => {
    setForm(prev => {
      const arr = [...prev.containers];
      arr[idx] = data;
      return { ...prev, containers: arr };
    });
  }, []);

  const addCommodity = useCallback(() => setForm(p => ({ ...p, commodities: [...p.commodities, emptyCommodity()] })), []);
  const removeCommodity = useCallback((i: number) => setForm(p => ({ ...p, commodities: p.commodities.filter((_, idx) => idx !== i) })), []);
  const addContainer = useCallback(() => setForm(p => ({ ...p, containers: [...p.containers, emptyContainer()] })), []);
  const removeContainer = useCallback((i: number) => setForm(p => ({ ...p, containers: p.containers.filter((_, idx) => idx !== i) })), []);

  const progress = useMemo(() => calcProgress(form), [form]);
  const isSaving = createFiling.isPending || updateFiling.isPending;

  // ─── Validation per step ───────────
  const validateStep = useCallback((s: number): boolean => {
    const e: Record<string, string> = {};
    const stepId = STEPS[s]?.id;

    if (stepId === 'filing') {
      if (!form.masterBol.trim()) e.masterBol = 'Master BOL is required';
      // House BOL is only required for ISF-10; ISF-5 derives it from the master BOL
      if (form.filingType === 'ISF-10' && !form.houseBol.trim()) e.houseBol = 'House BOL is required';
    }

    // ISF-10: IOR & Consignee step
    if (stepId === 'importer') {
      if (!form.importerName.trim()) e.importerName = 'Importer name is required';
      if (!form.importerNumber.trim()) e.importerNumber = 'IOR number is required (XX-XXXXXXXXX)';
      else if (!/^\d{2}-[A-Z0-9]{7,9}$/i.test(form.importerNumber.trim()))
        e.importerNumber = 'Format: XX-XXXXXXXXX (e.g., 20-493538700)';
      if (!form.consigneeName.trim()) e.consigneeName = 'Consignee name is required';
    }

    // ISF-5: Filer & Booking Party step
    if (stepId === 'filer') {
      if (!form.isf5.ISFFilerName.trim()) e['isf5.ISFFilerName'] = 'ISF Filer name is required';
      if (!form.isf5.ISFFilerNumber.trim()) e['isf5.ISFFilerNumber'] = 'ISF Filer EIN is required (XX-XXXXXXXXX)';
      else if (!/^\d{2}-[A-Z0-9]{7,9}$/i.test(form.isf5.ISFFilerNumber.trim()))
        e['isf5.ISFFilerNumber'] = 'Format: XX-XXXXXXXXX (e.g., 20-493538700)';
      if (!form.isf5.bookingPartyName.trim()) e['isf5.bookingPartyName'] = 'Booking Party name is required';
      if (!form.isf5.bookingPartyCountry) e['isf5.bookingPartyCountry'] = 'Booking Party country is required';
    }

    // ISF-10: Transport step
    if (stepId === 'transport') {
      if (!form.scacCode.trim()) e.scacCode = 'SCAC code is required';
      else if (!/^[A-Z]{4}$/i.test(form.scacCode.trim()))
        e.scacCode = 'Must be exactly 4 letters (e.g., MAEU)';
      if (!form.vesselName.trim()) e.vesselName = 'Vessel name is required';
      if (!form.estimatedArrival) e.estimatedArrival = 'Estimated arrival is required';
    }

    // Cargo step (same id for both ISF-10 and ISF-5)
    if (stepId === 'cargo') {
      if (form.commodities.length === 0) e['commodities.0.htsCode'] = 'At least one commodity required';
      form.commodities.forEach((c, i) => {
        if (!c.htsCode.trim()) e[`commodities.${i}.htsCode`] = 'HTS code required';
        else {
          const digits = c.htsCode.replace(/[\.\-\s]/g, '');
          if (digits.length < 6) e[`commodities.${i}.htsCode`] = 'Must be at least 6 digits';
        }
        if (!c.countryOfOrigin) e[`commodities.${i}.countryOfOrigin`] = 'Country of origin required';
      });
    }

    // ISF-5 parties step: Ship-To & Manufacturer
    if (stepId === 'parties' && form.filingType === 'ISF-5') {
      if (!form.shipToParty.name.trim()) e['shipToParty.name'] = 'Ship-To Party name is required';
      if (!form.manufacturer.name.trim()) e['manufacturer.name'] = 'Manufacturer name is required';
      if (!form.manufacturer.country) e['manufacturer.country'] = 'Manufacturer country is required';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form, STEPS]);

  const goNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      if (validateStep(step)) setStep(step + 1);
      else toast.error('Please fix the highlighted errors before continuing.');
    }
  }, [step, validateStep, STEPS]);

  const goBack = useCallback(() => { if (step > 0) setStep(step - 1); }, [step]);

  // ─── Build payload ─────────────────
  const buildPayload = useCallback(() => {
    const partyObj = (p: PartyFormData): PartyInfo | undefined => {
      if (!p.name.trim()) return undefined;
      return {
        name: p.name, address1: p.address1 || undefined, address2: p.address2 || undefined,
        city: p.city || undefined, state: p.state || undefined, zip: p.zip || undefined, country: p.country || undefined,
      } as PartyInfo;
    };
    const commodities: CommodityInfo[] = form.commodities
      .filter(c => c.htsCode.trim())
      .map(c => ({
        htsCode: c.htsCode.replace(/[\.\-\s]/g, '').slice(0, 6),
        description: c.description || undefined,
        countryOfOrigin: c.countryOfOrigin,
        quantity: c.quantity ? Number(c.quantity) : undefined,
        quantityUOM: c.quantityUOM || undefined,
        weight: c.weight ? { value: Number(c.weight), unit: c.weightUOM || 'K' } : undefined,
      } as any));
    const containers: ContainerInfo[] = form.containers
      .filter(c => c.number.trim())
      .map(c => ({ number: c.number, type: c.type || 'CN' }));

    return {
      filingType: form.filingType,
      masterBol: form.masterBol || undefined,
      houseBol: form.houseBol || undefined,
      bondType: form.bondType || undefined,
      importerName: form.importerName || undefined,
      importerNumber: form.importerNumber || undefined,
      consigneeName: form.consigneeName || undefined,
      consigneeNumber: form.consigneeNumber || undefined,
      consigneeAddress: form.consigneeAddress.address1.trim() ? {
        name: form.consigneeName || undefined,
        address1: form.consigneeAddress.address1 || undefined,
        address2: form.consigneeAddress.address2 || undefined,
        city: form.consigneeAddress.city || undefined,
        state: form.consigneeAddress.state || undefined,
        zip: form.consigneeAddress.zip || undefined,
        country: form.consigneeAddress.country || undefined,
      } as PartyInfo : undefined,
      buyer: partyObj(form.buyer),
      seller: partyObj(form.seller),
      shipToParty: partyObj(form.shipToParty),
      manufacturer: form.manufacturer.name.trim() ? [partyObj(form.manufacturer)] : undefined,
      consolidator: partyObj(form.consolidator),
      containerStuffingLocation: partyObj(form.containerStuffingLocation),
      scacCode: form.scacCode || undefined,
      vesselName: form.vesselName || undefined,
      voyageNumber: form.voyageNumber || undefined,
      foreignPortOfUnlading: form.foreignPortOfUnlading || undefined,
      estimatedDeparture: form.estimatedDeparture || undefined,
      estimatedArrival: form.estimatedArrival || undefined,
      commodities,
      containers,
      // Include ISF-5 specific data when applicable
      ...(form.filingType === 'ISF-5' ? {
        isf5Data: {
          bookingPartyName: form.isf5.bookingPartyName || undefined,
          bookingPartyTaxID: form.isf5.bookingPartyTaxID || undefined,
          bookingPartyIdentifierCode: form.isf5.bookingPartyIdentifierCode || undefined,
          bookingPartyAddress1: form.isf5.bookingPartyAddress1 || undefined,
          bookingPartyAddress2: form.isf5.bookingPartyAddress2 || undefined,
          bookingPartyCity: form.isf5.bookingPartyCity || undefined,
          bookingPartyStateOrProvince: form.isf5.bookingPartyStateOrProvince || undefined,
          bookingPartyPostalCode: form.isf5.bookingPartyPostalCode || undefined,
          bookingPartyCountry: form.isf5.bookingPartyCountry || undefined,
          ISFFilerName: form.isf5.ISFFilerName || undefined,
          ISFFilerLastName: form.isf5.ISFFilerLastName || form.isf5.ISFFilerName || undefined,
          ISFFilerIDCodeQualifier: form.isf5.ISFFilerIDCodeQualifier || '24',
          ISFFilerNumber: form.isf5.ISFFilerNumber || undefined,
          ISFShipmentTypeCode: form.isf5.ISFShipmentTypeCode || '01',
          bondActivityCode: form.isf5.bondActivityCode || '01',
          bondHolderID: form.isf5.bondHolderID || form.isf5.ISFFilerNumber || undefined,
          USPortOfArrival: form.isf5.USPortOfArrival || form.foreignPortOfUnlading || undefined,
        },
        // For ISF-5, store filer info also in importerName/Number for fallback
        importerName: form.isf5.ISFFilerName || form.importerName || undefined,
        importerNumber: form.isf5.ISFFilerNumber || form.importerNumber || undefined,
      } : {}),
    };
  }, [form]);

  const handleSubmit = async () => {
    const payload = buildPayload();
    try {
      if (isEdit && id) {
        await updateFiling.mutateAsync({ id, data: payload });
        toast.success('Filing updated successfully!');
        navigate(`/shipments/${id}`);
      } else {
        const created = await createFiling.mutateAsync(payload);
        toast.success('ISF filing created! You can now review and submit it to CBP.', { duration: 5000 });
        navigate(`/shipments/${created.id}`);
      }
    } catch (err: any) {
      const body = err.body;
      if (body?.validationErrors) {
        const msgs = body.validationErrors.map((e: any) => e.message).join('\n');
        toast.error(`Validation failed:\n${msgs}`, { duration: 8000 });
      } else if (body?.details) {
        toast.error(`Validation: ${JSON.stringify(body.details)}`, { duration: 8000 });
      } else {
        toast.error(body?.error || 'Failed to save filing');
      }
    }
  };

  // ─── Loading State ─────────────────
  if (isEdit && isLoadingFiling) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" /><Skeleton className="h-2 w-full" />
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      </div>
    );
  }

  // ─── Step Renderers ────────────────

  const renderFilingInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SelectField label="Filing Type" required value={form.filingType}
          onChange={v => set('filingType', v as 'ISF-10' | 'ISF-5')}
          options={[{ value: 'ISF-10', label: 'ISF-10 — Importer Security Filing (10+2)' }, { value: 'ISF-5', label: 'ISF-5 — Carrier Security Filing' }]}
          hint="ISF-10 is required for most ocean shipments to the US" />
        <SelectField label="Bond Type" required value={form.bondType}
          onChange={v => set('bondType', v)} options={BOND_TYPES}
          hint="Continuous bond (type 8) covers multiple shipments; Single transaction (type 9) for one-time" />
      </div>
      <Separator />
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Bills of Lading
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField label="Master Bill of Lading" required value={form.masterBol}
            onChange={v => set('masterBol', v)} placeholder="e.g., MAEU1234567890"
            hint="Master BOL issued by the ocean carrier" error={errors.masterBol} maxLength={50} />
          <TextField label="House Bill of Lading" required={form.filingType === 'ISF-10'} value={form.houseBol}
            onChange={v => set('houseBol', v)} placeholder="e.g., HCLA12345678"
            hint={form.filingType === 'ISF-5' ? 'Optional for ISF-5 — will be auto-derived from Master BOL if left blank.' : 'House BOL from your freight forwarder. This is used to send documents to CBP.'}
            error={errors.houseBol} maxLength={50} />
        </div>
      </div>
    </div>
  );

  const renderImporterConsignee = () => (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-900/40">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Importer of Record (IOR)</CardTitle>
              <CardDescription className="text-xs">The entity responsible for the ISF filing. Uses EIN (XX-XXXXXXXXX) format.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Importer Name" required value={form.importerName}
              onChange={v => set('importerName', v)} maxLength={35} error={errors.importerName}
              placeholder="e.g., Acme Imports Inc" hint="Max 35 chars. No periods — CC rejects them." />
            <TextField label="IOR Number (EIN)" required value={form.importerNumber}
              onChange={v => set('importerNumber', v)} placeholder="XX-XXXXXXXXX"
              hint="Employer Identification Number. Format: 2 digits, dash, 9 digits." error={errors.importerNumber} maxLength={12} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10 dark:border-green-900/40">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Consignee</CardTitle>
              <CardDescription className="text-xs">The party to whom the shipment is ultimately delivered.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Consignee Name" required value={form.consigneeName}
              onChange={v => set('consigneeName', v)} maxLength={35} error={errors.consigneeName}
              placeholder="e.g., Acme Imports Inc" hint="Max 35 chars. No periods." />
            <TextField label="Consignee Number (EIN)" value={form.consigneeNumber}
              onChange={v => set('consigneeNumber', v)} placeholder="XX-XXXXXXXXX"
              hint="EIN for the consignee. Same format as IOR." maxLength={12} />
          </div>
          <Separator className="my-2" />
          <p className="text-xs font-medium text-muted-foreground">Consignee Address</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Address Line 1" required value={form.consigneeAddress.address1}
              onChange={v => setParty('consigneeAddress', { ...form.consigneeAddress, address1: v })}
              maxLength={35} placeholder="Street address" />
            <TextField label="Address Line 2" value={form.consigneeAddress.address2}
              onChange={v => setParty('consigneeAddress', { ...form.consigneeAddress, address2: v })}
              maxLength={35} placeholder="Suite, floor" hint="Optional. Don't use just a period." />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TextField label="City" required value={form.consigneeAddress.city}
              onChange={v => setParty('consigneeAddress', { ...form.consigneeAddress, city: v })} maxLength={35} />
            <TextField label="State" value={form.consigneeAddress.state}
              onChange={v => setParty('consigneeAddress', { ...form.consigneeAddress, state: v })} maxLength={4} placeholder="ST" />
            <TextField label="Postal Code" value={form.consigneeAddress.zip}
              onChange={v => setParty('consigneeAddress', { ...form.consigneeAddress, zip: v })} maxLength={10} placeholder="00000" />
            <SelectField label="Country" required value={form.consigneeAddress.country}
              onChange={v => setParty('consigneeAddress', { ...form.consigneeAddress, country: v })}
              options={COMMON_COUNTRIES} placeholder="Select" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderTradeParties = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PartyCard title="Buyer" icon={Users} party={form.buyer} onChange={p => setParty('buyer', p)} />
      <PartyCard title="Seller" icon={Users} party={form.seller} onChange={p => setParty('seller', p)} />
      <PartyCard title="Ship-To Party" icon={MapPin} party={form.shipToParty} onChange={p => setParty('shipToParty', p)} />
      <PartyCard title="Manufacturer / Supplier" icon={Building2} party={form.manufacturer} onChange={p => setParty('manufacturer', p)} />
      <PartyCard title="Consolidator" icon={Container} party={form.consolidator} onChange={p => setParty('consolidator', p)} />
      <PartyCard title="Container Stuffing Location" icon={Package} party={form.containerStuffingLocation} onChange={p => setParty('containerStuffingLocation', p)} />
    </div>
  );

  const renderTransport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TextField label="SCAC Code" required value={form.scacCode}
          onChange={v => set('scacCode', v.toUpperCase())} placeholder="MAEU"
          hint="Standard Carrier Alpha Code — exactly 4 uppercase letters" error={errors.scacCode} maxLength={4} />
        <TextField label="Vessel Name" required value={form.vesselName}
          onChange={v => set('vesselName', v)} placeholder="e.g., EVER GIVEN"
          hint="Full vessel name" error={errors.vesselName} maxLength={35} />
        <TextField label="Voyage Number" value={form.voyageNumber}
          onChange={v => set('voyageNumber', v)} placeholder="e.g., V001"
          hint="Voyage or trip number" maxLength={20} />
      </div>
      <Separator />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PortSelectField label="US Port of Arrival" required value={form.foreignPortOfUnlading}
          onChange={v => set('foreignPortOfUnlading', v)} options={CBP_PORTS_4DIGIT}
          placeholder="Search ports…" hint="4-digit CBP port code for the US port of arrival." />
        <div className="space-y-1.5">
          <HintLabel label="Est. Departure Date" hint="When the vessel departs the foreign port" />
          <Input type="date" value={form.estimatedDeparture} onChange={e => set('estimatedDeparture', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <HintLabel label="Est. Arrival Date" required hint="When the vessel arrives at the US port" />
          <Input type="date" value={form.estimatedArrival} onChange={e => set('estimatedArrival', e.target.value)}
            className={cn(errors.estimatedArrival && 'border-red-500')} />
          {errors.estimatedArrival && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.estimatedArrival}</p>}
        </div>
      </div>
    </div>
  );

  const renderCargo = () => (
    <div className="space-y-6">
      {/* Commodities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Commodities
          </h3>
          <Button variant="outline" size="sm" onClick={addCommodity}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
          </Button>
        </div>
        <div className="space-y-4">
          {form.commodities.map((c, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="pt-4 pb-4 px-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">Item {i + 1}</Badge>
                  {form.commodities.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeCommodity(i)} className="text-destructive hover:text-destructive h-7 px-2">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <TextField label="Description" value={c.description}
                    onChange={v => setCommodity(i, { ...c, description: v })} placeholder="e.g., Steel Bolts"
                    hint="Short commodity description" maxLength={50} />
                  <HTSAutocomplete
                    value={c.htsCode}
                    onChange={v => setCommodity(i, { ...c, htsCode: v })}
                    description={c.description}
                    error={errors[`commodities.${i}.htsCode`]}
                    maxLength={10}
                  />
                  <SelectField label="Country of Origin" required value={c.countryOfOrigin}
                    onChange={v => setCommodity(i, { ...c, countryOfOrigin: v })} options={COMMON_COUNTRIES}
                    placeholder="Select" error={errors[`commodities.${i}.countryOfOrigin`]}
                    hint="Where the goods were manufactured" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <TextField label="Quantity" value={c.quantity}
                    onChange={v => setCommodity(i, { ...c, quantity: v })} placeholder="100" />
                  <SelectField label="Qty Unit" value={c.quantityUOM}
                    onChange={v => setCommodity(i, { ...c, quantityUOM: v })} options={QUANTITY_UOMS} />
                  <TextField label="Weight" value={c.weight}
                    onChange={v => setCommodity(i, { ...c, weight: v })} placeholder="500" />
                  <SelectField label="Weight Unit" value={c.weightUOM}
                    onChange={v => setCommodity(i, { ...c, weightUOM: v })} options={WEIGHT_UOMS} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Containers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Container className="h-4 w-4 text-primary" /> Containers
          </h3>
          <Button variant="outline" size="sm" onClick={addContainer}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Container
          </Button>
        </div>
        <div className="space-y-3">
          {form.containers.map((ct, i) => (
            <div key={i} className="flex items-end gap-3">
              <TextField label={`Container ${i + 1} Number`} value={ct.number} className="flex-1"
                onChange={v => setContainer(i, { ...ct, number: v })} placeholder="e.g., TEMU1234567"
                hint="ISO 6346 format: 4 letters + 7 digits" maxLength={15} />
              <SelectField label="Type" value={ct.type} className="w-48"
                onChange={v => setContainer(i, { ...ct, type: v })} options={CONTAINER_TYPES} />
              {form.containers.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeContainer(i)} className="text-destructive hover:text-destructive shrink-0 mb-0.5">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── ISF-5: Filer & Booking Party Step ─────
  const renderISF5FilerBookingParty = () => (
    <div className="space-y-6">
      {/* ISF Filer (carrier/NVOCC) */}
      <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-900/40">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">ISF Filer (Carrier / NVOCC)</CardTitle>
              <CardDescription className="text-xs">The carrier or NVOCC filing the ISF-5. Uses EIN (XX-XXXXXXXXX) format.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Filer Name" required value={form.isf5.ISFFilerName}
              onChange={v => setISF5('ISFFilerName', v)} maxLength={25} error={errors['isf5.ISFFilerName']}
              placeholder="e.g., Acme Shipping LLC" hint="Max 25 chars. Carrier/NVOCC name." />
            <TextField label="Filer EIN Number" required value={form.isf5.ISFFilerNumber}
              onChange={v => setISF5('ISFFilerNumber', v)} placeholder="XX-XXXXXXXXX"
              hint="Employer Identification Number of the filer." error={errors['isf5.ISFFilerNumber']} maxLength={12} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Bond Holder ID" value={form.isf5.bondHolderID}
              onChange={v => setISF5('bondHolderID', v)} placeholder="XX-XXXXXXXXX"
              hint="EIN of the bond holder. Defaults to the filer's EIN." maxLength={12} />
            <PortSelectField label="US Port of Arrival" value={form.isf5.USPortOfArrival}
              onChange={v => setISF5('USPortOfArrival', v)} options={CBP_PORTS_4DIGIT}
              placeholder="Search ports…" hint="4-digit CBP port code for the US port of arrival" />
          </div>
        </CardContent>
      </Card>

      {/* Booking Party */}
      <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10 dark:border-green-900/40">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Booking Party</CardTitle>
              <CardDescription className="text-xs">The party that booked the cargo space with the carrier.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField label="Booking Party Name" required value={form.isf5.bookingPartyName}
              onChange={v => setISF5('bookingPartyName', v)} maxLength={35} error={errors['isf5.bookingPartyName']}
              placeholder="e.g., ABC Trading Co" hint="Max 35 chars. No periods or special characters." />
            <TextField label="Tax ID" value={form.isf5.bookingPartyTaxID}
              onChange={v => setISF5('bookingPartyTaxID', v)} placeholder="Optional"
              hint="Tax ID if available" maxLength={20} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField label="Address Line 1" value={form.isf5.bookingPartyAddress1}
              onChange={v => setISF5('bookingPartyAddress1', v)} maxLength={35} placeholder="Street address" />
            <TextField label="Address Line 2" value={form.isf5.bookingPartyAddress2}
              onChange={v => setISF5('bookingPartyAddress2', v)} maxLength={35} placeholder="Suite, floor" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TextField label="City" value={form.isf5.bookingPartyCity}
              onChange={v => setISF5('bookingPartyCity', v)} maxLength={35} placeholder="City" />
            <TextField label="State" value={form.isf5.bookingPartyStateOrProvince}
              onChange={v => setISF5('bookingPartyStateOrProvince', v)} maxLength={4} placeholder="ST" />
            <TextField label="Postal Code" value={form.isf5.bookingPartyPostalCode}
              onChange={v => setISF5('bookingPartyPostalCode', v)} maxLength={10} placeholder="00000" />
            <SelectField label="Country" required value={form.isf5.bookingPartyCountry}
              onChange={v => setISF5('bookingPartyCountry', v)} options={COMMON_COUNTRIES}
              placeholder="Select" error={errors['isf5.bookingPartyCountry']} />
          </div>
        </CardContent>
      </Card>

      {/* Estimated Arrival & Transport basics for ISF-5 */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Ship className="h-4 w-4 text-primary" /> Shipment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <HintLabel label="Est. Arrival Date" required hint="When the shipment arrives at the US port" />
              <Input type="date" value={form.estimatedArrival} onChange={e => set('estimatedArrival', e.target.value)} />
            </div>
            <PortSelectField label="Foreign Port of Unlading" value={form.foreignPortOfUnlading}
              onChange={v => set('foreignPortOfUnlading', v)} options={SCHEDULE_D_PORTS}
              placeholder="Search ports…" hint="5-digit Schedule D code for the foreign port where cargo is unladen" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ─── ISF-5: Ship-To & Manufacturer Step ────
  const renderISF5Parties = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PartyCard title="Ship-To Party" icon={MapPin} party={form.shipToParty}
        onChange={p => setParty('shipToParty', p)} />
      <PartyCard title="Manufacturer / Supplier" icon={Building2} party={form.manufacturer}
        onChange={p => setParty('manufacturer', p)} />
    </div>
  );

  const renderReview = () => {
    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">{children}</div>
      </div>
    );
    const Item = ({ label, value }: { label: string; value?: string }) => (
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn('font-medium truncate', !value && 'text-muted-foreground italic')}>{value || 'Not set'}</span>
      </div>
    );
    const PartyReview = ({ title, p }: { title: string; p: PartyFormData }) => (
      <div className="rounded-lg border p-3 space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="text-sm font-semibold">{p.name || <span className="italic text-muted-foreground">Not set</span>}</p>
        {p.address1 && <p className="text-xs text-muted-foreground">{p.address1}{p.address2 ? `, ${p.address2}` : ''}</p>}
        {(p.city || p.state || p.zip) && <p className="text-xs text-muted-foreground">{[p.city, p.state, p.zip].filter(Boolean).join(', ')}</p>}
        {p.country && <Badge variant="outline" className="text-xs mt-1">{p.country}</Badge>}
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">Ready to create your ISF filing</p>
            <p className="text-xs text-muted-foreground">Review all details below. After creating, go to the filing list and click "Submit" to send to CBP.</p>
          </div>
        </div>

        <Section title="Filing & BOL">
          <Item label="Filing Type" value={form.filingType} />
          <Item label="Master BOL" value={form.masterBol} />
          <Item label="House BOL" value={form.houseBol} />
          <Item label="Bond Type" value={BOND_TYPES.find(b => b.value === form.bondType)?.label} />
        </Section>

        <Separator />

        {form.filingType === 'ISF-10' ? (
          <>
            <Section title="IOR & Consignee">
              <Item label="Importer Name" value={form.importerName} />
              <Item label="IOR Number" value={form.importerNumber} />
              <Item label="Consignee" value={form.consigneeName} />
              <Item label="Consignee Number" value={form.consigneeNumber} />
              <Item label="Consignee Address" value={[form.consigneeAddress.address1, form.consigneeAddress.city, form.consigneeAddress.country].filter(Boolean).join(', ')} />
            </Section>

            <Separator />

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Trade Parties</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <PartyReview title="Buyer" p={form.buyer} />
                <PartyReview title="Seller" p={form.seller} />
                <PartyReview title="Ship-To" p={form.shipToParty} />
                <PartyReview title="Manufacturer" p={form.manufacturer} />
                <PartyReview title="Consolidator" p={form.consolidator} />
                <PartyReview title="Container Stuffing" p={form.containerStuffingLocation} />
              </div>
            </div>

            <Separator />

            <Section title="Transport">
              <Item label="SCAC" value={form.scacCode} />
              <Item label="Vessel" value={form.vesselName} />
              <Item label="Voyage" value={form.voyageNumber} />
              <Item label="US Port" value={CBP_PORTS_4DIGIT.find(p => p.value === form.foreignPortOfUnlading)?.label || form.foreignPortOfUnlading} />
              <Item label="Departure" value={form.estimatedDeparture} />
              <Item label="Arrival" value={form.estimatedArrival} />
            </Section>
          </>
        ) : (
          <>
            <Section title="ISF Filer (Carrier / NVOCC)">
              <Item label="Filer Name" value={form.isf5.ISFFilerName} />
              <Item label="Filer EIN" value={form.isf5.ISFFilerNumber} />
              <Item label="Bond Holder ID" value={form.isf5.bondHolderID || form.isf5.ISFFilerNumber} />
              <Item label="US Port" value={CBP_PORTS_4DIGIT.find(p => p.value === (form.isf5.USPortOfArrival || form.foreignPortOfUnlading))?.label || form.isf5.USPortOfArrival || form.foreignPortOfUnlading} />
              <Item label="Foreign Port" value={SCHEDULE_D_PORTS.find(p => p.value === form.foreignPortOfUnlading)?.label || form.foreignPortOfUnlading || 'Not set'} />
              <Item label="Arrival" value={form.estimatedArrival} />
            </Section>

            <Separator />

            <Section title="Booking Party">
              <Item label="Name" value={form.isf5.bookingPartyName} />
              <Item label="Tax ID" value={form.isf5.bookingPartyTaxID} />
              <Item label="Address" value={[form.isf5.bookingPartyAddress1, form.isf5.bookingPartyCity, form.isf5.bookingPartyCountry].filter(Boolean).join(', ')} />
            </Section>

            <Separator />

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Parties</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <PartyReview title="Ship-To" p={form.shipToParty} />
                <PartyReview title="Manufacturer" p={form.manufacturer} />
              </div>
            </div>
          </>
        )}

        <Separator />

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Commodities</h4>
          {form.commodities.filter(c => c.htsCode).map((c, i) => (
            <div key={i} className="rounded-lg border p-3 flex flex-wrap gap-x-6 gap-y-1 text-sm mb-2">
              <Item label="HTS" value={c.htsCode} /><Item label="Description" value={c.description} />
              <Item label="Origin" value={c.countryOfOrigin} /><Item label="Qty" value={c.quantity ? `${c.quantity} ${c.quantityUOM}` : undefined} />
              <Item label="Weight" value={c.weight ? `${c.weight} ${c.weightUOM}` : undefined} />
            </div>
          ))}
        </div>

        {form.containers.some(c => c.number) && <>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Containers</h4>
            <div className="flex flex-wrap gap-2">
              {form.containers.filter(c => c.number).map((c, i) => (
                <Badge key={i} variant="outline" className="text-sm py-1 px-3 font-mono">{c.number} ({c.type})</Badge>
              ))}
            </div>
          </div>
        </>}
      </div>
    );
  };

  // Build step content array based on filing type
  const stepContent = form.filingType === 'ISF-5'
    ? [renderFilingInfo, renderISF5FilerBookingParty, renderISF5Parties, renderCargo, renderReview]
    : [renderFilingInfo, renderImporterConsignee, renderTradeParties, renderTransport, renderCargo, renderReview];

  // ─── Render ────────────────────────
  return (
    <div className="space-y-5 max-w-[1200px] w-full mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link to="/shipments"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit ISF Filing' : 'New ISF Filing'}</h1>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {STEPS.length} — {STEPS[step].desc}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="text-lg font-bold text-primary">{progress}%</p>
          </div>
          <div className="w-20">
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Pre-fill banner — copy varies by source kind. */}
      {sourceProvenance && !isEdit && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-foreground">
              Started from {sourceProvenance.kind === 'filing' ? 'filing' : 'manifest query'}{' '}
              <Link
                to={sourceProvenance.url}
                className="font-mono text-foreground underline-offset-2 hover:underline"
              >
                {sourceProvenance.label}
              </Link>
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
              {sourceProvenance.kind === 'filing'
                ? 'We carried over parties, bond, vessel, and the first commodity. BOL, voyage, dates, and containers are blanked — those must be unique per shipment.'
                : 'We carried over the BOL, carrier, port of unlading, and arrival date. Importer, consignee, parties, bond, vessel, and commodities still need to be filled in.'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSourceProvenance(null);
              setSearchParams(p => {
                p.delete('fromFiling');
                p.delete('fromManifestQuery');
                return p;
              }, { replace: true });
              setForm(initialForm());
            }}
            className="text-xs h-7 text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Step Progress Bar */}
      <div className="bg-card border rounded-xl p-3">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.id} className="flex items-center flex-1 min-w-0">
                <button onClick={() => { if (i <= step) setStep(i); }}
                  disabled={i > step}
                  className={cn(
                    'flex items-center gap-2 transition-all rounded-lg px-2 py-1.5 text-left min-w-0',
                    isActive && 'bg-primary/10',
                    isDone && 'cursor-pointer hover:bg-muted',
                    i > step && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <span className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all',
                    isDone ? 'bg-primary text-primary-foreground' :
                    isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' :
                    'bg-muted text-muted-foreground',
                  )}>
                    {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className={cn('text-xs font-medium truncate hidden lg:block', isActive && 'text-primary')}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn('h-0.5 flex-1 mx-1 rounded-full min-w-2', isDone ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
            );
          })}
        </div>
        {/* Mobile progress */}
        <div className="sm:hidden mt-2">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1 text-center">{progress}% complete</p>
        </div>
      </div>

      {/* Step Content */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
            <CardTitle className="text-lg">{STEPS[step].label}</CardTitle>
          </div>
          <CardDescription>{STEPS[step].desc}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {stepContent[step]()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pb-6">
        <Button variant="outline" onClick={goBack} disabled={step === 0} size="lg">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext} size="lg">
              Next <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSaving} size="lg" className="min-w-[200px]">
              {isSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> {isEdit ? 'Save Changes' : 'Create ISF Filing'}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
