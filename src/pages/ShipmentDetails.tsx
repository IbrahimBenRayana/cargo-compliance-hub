import { useParams, Link } from 'react-router-dom';
import { mockShipments } from '@/data/mock-data';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, RotateCcw, ArrowLeft, CheckCircle2, Circle, XCircle, Send } from 'lucide-react';

export default function ShipmentDetails() {
  const { id } = useParams();
  const shipment = mockShipments.find(s => s.id === id);

  if (!shipment) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Shipment not found</p>
        <Button variant="link" asChild className="mt-2"><Link to="/shipments">Back to shipments</Link></Button>
      </div>
    );
  }

  const timeline = [
    { label: 'Created', date: shipment.createdAt, icon: Circle, done: true },
    { label: 'Submitted', date: shipment.submittedAt, icon: Send, done: !!shipment.submittedAt },
    ...(shipment.status === 'rejected'
      ? [{ label: 'Rejected', date: shipment.rejectedAt, icon: XCircle, done: true }]
      : [{ label: 'Accepted', date: shipment.acceptedAt, icon: CheckCircle2, done: !!shipment.acceptedAt }]),
  ];

  const sections = [
    { title: 'Parties', items: [
      ['Manufacturer', shipment.parties.manufacturer],
      ['Seller', shipment.parties.seller],
      ['Buyer', shipment.parties.buyer],
      ['Ship-to Party', shipment.parties.shipToParty],
    ]},
    { title: 'Shipment Info', items: [
      ['Bill of Lading', shipment.shipmentInfo.billOfLading],
      ['Vessel Name', shipment.shipmentInfo.vesselName],
      ['Voyage Number', shipment.shipmentInfo.voyageNumber],
    ]},
    { title: 'Product Info', items: [
      ['HTS Code', shipment.productInfo.htsCode],
      ['Country of Origin', shipment.productInfo.countryOfOrigin],
      ['Description', shipment.productInfo.description],
    ]},
    { title: 'Logistics', items: [
      ['Container Stuffing Location', shipment.logistics.containerStuffingLocation],
      ['Consolidator', shipment.logistics.consolidator],
    ]},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/shipments"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{shipment.id}</h1>
            <StatusBadge status={shipment.status} />
          </div>
          <p className="text-sm text-muted-foreground">{shipment.shipmentInfo.billOfLading} · {shipment.importerName}</p>
        </div>
        <div className="flex gap-2">
          {(shipment.status === 'draft' || shipment.status === 'rejected') && (
            <Button variant="outline" asChild><Link to={`/shipments/${shipment.id}/edit`}><Pencil className="h-4 w-4 mr-1" /> Edit</Link></Button>
          )}
          {shipment.status === 'rejected' && (
            <Button><RotateCcw className="h-4 w-4 mr-1" /> Resubmit</Button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base font-medium">Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {timeline.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <step.icon className={`h-4 w-4 ${step.done ? (step.label === 'Rejected' ? 'text-destructive' : 'text-[hsl(var(--status-accepted))]') : ''}`} />
                  <div>
                    <p className="text-sm font-medium">{step.label}</p>
                    {step.date && <p className="text-xs text-muted-foreground">{new Date(step.date).toLocaleString()}</p>}
                  </div>
                </div>
                {i < timeline.length - 1 && <div className={`h-px w-12 ${step.done ? 'bg-foreground/30' : 'bg-border'}`} />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data sections */}
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(section => (
          <Card key={section.title}>
            <CardHeader className="pb-3"><CardTitle className="text-base font-medium">{section.title}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {section.items.map(([label, value]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label as string}</span>
                  <span className="font-medium text-right">{(value as string) || <span className="text-muted-foreground italic">Not provided</span>}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* API Response */}
      {(shipment.apiResponse || shipment.rejectionReason) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base font-medium">API Response</CardTitle></CardHeader>
          <CardContent>
            {shipment.rejectionReason && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 mb-3">
                <p className="text-sm text-destructive font-medium">{shipment.rejectionReason}</p>
              </div>
            )}
            {shipment.apiResponse && (
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">{JSON.stringify(JSON.parse(shipment.apiResponse), null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
