import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { mockShipments } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const steps = ['Parties', 'Shipment Info', 'Product Info', 'Logistics'];

export default function ShipmentWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = id ? mockShipments.find(s => s.id === id) : null;
  const isEdit = !!existing;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    manufacturer: existing?.parties.manufacturer ?? '',
    seller: existing?.parties.seller ?? '',
    buyer: existing?.parties.buyer ?? '',
    shipToParty: existing?.parties.shipToParty ?? '',
    billOfLading: existing?.shipmentInfo.billOfLading ?? '',
    vesselName: existing?.shipmentInfo.vesselName ?? '',
    voyageNumber: existing?.shipmentInfo.voyageNumber ?? '',
    htsCode: existing?.productInfo.htsCode ?? '',
    countryOfOrigin: existing?.productInfo.countryOfOrigin ?? '',
    description: existing?.productInfo.description ?? '',
    containerStuffingLocation: existing?.logistics.containerStuffingLocation ?? '',
    consolidator: existing?.logistics.consolidator ?? '',
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const Field = ({ label, field, required }: { label: string; field: string; required?: boolean }) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Input value={(form as Record<string, string>)[field]} onChange={e => update(field, e.target.value)} />
    </div>
  );

  const stepContent = [
    <div key="0" className="grid gap-4 sm:grid-cols-2">
      <Field label="Manufacturer" field="manufacturer" required />
      <Field label="Seller" field="seller" required />
      <Field label="Buyer" field="buyer" required />
      <Field label="Ship-to Party" field="shipToParty" required />
    </div>,
    <div key="1" className="grid gap-4 sm:grid-cols-2">
      <Field label="Bill of Lading" field="billOfLading" required />
      <Field label="Vessel Name" field="vesselName" required />
      <Field label="Voyage Number" field="voyageNumber" required />
    </div>,
    <div key="2" className="grid gap-4 sm:grid-cols-2">
      <Field label="HTS Code" field="htsCode" required />
      <Field label="Country of Origin" field="countryOfOrigin" required />
      <Field label="Description" field="description" />
    </div>,
    <div key="3" className="grid gap-4 sm:grid-cols-2">
      <Field label="Container Stuffing Location" field="containerStuffingLocation" required />
      <Field label="Consolidator" field="consolidator" required />
    </div>,
  ];

  const handleSubmit = () => {
    toast.success(isEdit ? 'Shipment updated and submitted!' : 'ISF filing submitted successfully!');
    navigate('/shipments');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/shipments"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? 'Edit ISF Filing' : 'Create New ISF Filing'}</h1>
          <p className="text-sm text-muted-foreground">Step {step + 1} of {steps.length}: {steps[step]}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <button
              onClick={() => setStep(i)}
              className={cn(
                'flex items-center gap-2 text-sm font-medium transition-colors',
                i <= step ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs border-2 shrink-0',
                i < step ? 'bg-primary text-primary-foreground border-primary' :
                i === step ? 'border-primary text-primary' : 'border-muted-foreground/30'
              )}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < steps.length - 1 && <div className={cn('h-px flex-1 mx-2', i < step ? 'bg-primary' : 'bg-border')} />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{steps[step]}</CardTitle></CardHeader>
        <CardContent>{stepContent[step]}</CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit}>
            <Check className="h-4 w-4 mr-1" /> Submit ISF
          </Button>
        )}
      </div>
    </div>
  );
}
