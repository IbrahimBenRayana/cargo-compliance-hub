/**
 * What was filed, as one record: who is on the ISF, the bills and the
 * voyage, the goods and the containers. One panel with quiet dividers, so
 * a filer checks a filing against their paperwork without hunting.
 */
import { countryName } from '@/components/shipments/countries';
import { cn } from '@/lib/utils';
import type { Filing, PartyInfo } from '@/types/shipment';
import { CopyButton } from './CopyButton';
import { usePortName } from './usePortName';

const H3 = 'text-[13px] font-semibold';
const LABEL = 'text-[12px] text-muted-foreground';
const EMPTY = <span className="font-sans text-[13.5px] font-normal text-muted-foreground">Not provided</span>;
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

type PartyValue = PartyInfo | PartyInfo[] | string | null | undefined;

/** A party as stored: an object, a list of them, a JSON string, or just a name. */
function partiesOf(value: PartyValue): PartyInfo[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch {
    // A plain name.
  }
  return [{ name: value }];
}

const placeOf = (p: PartyInfo) => [p.city, p.state, p.country].filter(Boolean).join(', ');

function Party({ label, value, id }: { label: string; value: PartyValue; id?: string | null }) {
  const list = partiesOf(value).filter((p) => p.name || placeOf(p));
  return (
    <div className="min-w-0">
      <dt className={LABEL}>{label}</dt>
      {list.length === 0 ? (
        <dd className="mt-0.5 text-[13.5px]">{EMPTY}</dd>
      ) : list.map((p, i) => (
        <dd key={i} className={cn('min-w-0', i > 0 ? 'mt-1.5' : 'mt-0.5')}>
          <span className="block truncate text-[13.5px] font-medium" title={p.name}>{p.name || placeOf(p)}</span>
          {p.name && placeOf(p) && <span className="block truncate text-[12.5px] text-muted-foreground">{placeOf(p)}</span>}
        </dd>
      ))}
      {id && <dd className="truncate font-mono text-[12px] text-muted-foreground">{id}</dd>}
    </div>
  );
}

function Fact({ label, mono, copy, sub, children }: { label: string; mono?: boolean; copy?: string | null; sub?: string | null; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-0.5 flex min-w-0 items-center gap-1">
        <span className={cn('truncate text-[13.5px] font-medium', mono && 'font-mono text-[13px]')}>{children || EMPTY}</span>
        {copy && <CopyButton value={copy} label={label.toLowerCase()} className="-my-1" />}
      </dd>
      {sub && <dd className="truncate text-[12.5px] text-muted-foreground" title={sub}>{sub}</dd>}
    </div>
  );
}

function Port({ label, code }: { label: string; code: string | null | undefined }) {
  const name = usePortName(code);
  return <Fact label={label} mono sub={name}>{code}</Fact>;
}

const GRID = 'mt-3 grid grid-cols-2 gap-x-6 gap-y-4 xl:grid-cols-3';

export function FilingDetails({ filing }: { filing: Filing }) {
  const isf5 = filing.filingType === 'ISF-5' ? filing.isf5Data ?? {} : null;
  const goods = filing.commodities ?? [];
  const containers = filing.containers ?? [];

  return (
    <section aria-labelledby="filed-title" className="rounded-xl border border-border/70 bg-card shadow-card">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
        <h2 id="filed-title" className="text-[15px] font-semibold">{filing.status === 'draft' ? 'What will be filed' : 'What was filed'}</h2>
        <p className="text-[12.5px] text-muted-foreground">{filing.filingType}</p>
      </div>

      <div className="px-5 pb-5 pt-4">
        <h3 className={H3}>Parties</h3>
        {isf5 ? (
          <dl className={GRID}>
            <Party label="ISF filer" value={isf5.ISFFilerName || filing.importerName} id={isf5.ISFFilerNumber || filing.importerNumber} />
            <Party label="Booking party" value={isf5.bookingPartyName ? { name: isf5.bookingPartyName, country: isf5.bookingPartyCountry } : null} />
            <Party label="Ship-to party" value={filing.shipToParty} />
            <Party label="Manufacturer" value={filing.manufacturer} />
            <Fact label="Bond holder ID" mono>{isf5.bondHolderID}</Fact>
          </dl>
        ) : (
          <dl className={GRID}>
            <Party label="Importer" value={filing.importerName} id={filing.importerNumber} />
            <Party label="Consignee" value={filing.consigneeName} id={filing.consigneeNumber} />
            <Party label="Buyer" value={filing.buyer} />
            <Party label="Seller" value={filing.seller} />
            <Party label="Manufacturer" value={filing.manufacturer} />
            <Party label="Ship-to party" value={filing.shipToParty} />
            <Party label="Container stuffing" value={filing.containerStuffingLocation} />
            <Party label="Consolidator" value={filing.consolidator} />
          </dl>
        )}
      </div>

      <div className="border-t border-border/70 px-5 py-5">
        <h3 className={H3}>Bills and voyage</h3>
        <dl className={GRID}>
          <Fact label="Master bill" mono copy={filing.masterBol}>{filing.masterBol}</Fact>
          <Fact label="House bill" mono copy={filing.houseBol}>{filing.houseBol}</Fact>
          {!isf5 && <Fact label="SCAC" mono>{filing.scacCode}</Fact>}
          {!isf5 && <Fact label="Vessel">{filing.vesselName}</Fact>}
          {!isf5 && <Fact label="Voyage" mono>{filing.voyageNumber}</Fact>}
          <Fact label="Bond type">{filing.bondType}</Fact>
          {isf5 ? (
            <Port label="US port of arrival" code={isf5.USPortOfArrival || filing.foreignPortOfUnlading} />
          ) : (
            <>
              <Port label="Port of unlading" code={filing.foreignPortOfUnlading} />
              <Port label="Place of delivery" code={filing.placeOfDelivery} />
            </>
          )}
          {!isf5 && <Fact label="Est. departure">{filing.estimatedDeparture && longDate(filing.estimatedDeparture)}</Fact>}
          {!isf5 && filing.estimatedLading && <Fact label="Est. lading">{longDate(filing.estimatedLading)}</Fact>}
          <Fact label="Est. arrival">{filing.estimatedArrival && longDate(filing.estimatedArrival)}</Fact>
        </dl>
      </div>

      <div className="border-t border-border/70 py-5">
        <h3 className={cn(H3, 'flex items-center gap-2 px-5')}>
          Goods
          <span className="rounded-md bg-muted px-1.5 py-px text-[11.5px] font-medium tabular-nums text-muted-foreground">{goods.length}</span>
        </h3>
        {goods.length === 0 ? (
          <p className="mt-2 px-5 text-[13px] text-muted-foreground">No goods on this ISF yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted-foreground">
                  <th scope="col" className="px-5 pb-2 font-medium">Description</th>
                  <th scope="col" className="px-3 pb-2 font-medium">HTS</th>
                  <th scope="col" className="px-3 pb-2 font-medium">Origin</th>
                  <th scope="col" className="px-5 pb-2 text-right font-medium">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {goods.map((c, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-5 py-2.5 font-medium">{c.description || <span className="font-normal text-muted-foreground">No description</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {c.htsCode ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[12px] text-primary">{c.htsCode}</span> : <span className="text-muted-foreground">Not set</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{c.countryOfOrigin ? countryName(c.countryOfOrigin) : <span className="text-muted-foreground">Not set</span>}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{c.quantity ?? <span className="text-muted-foreground">Not set</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {containers.length > 0 && (
        <div className="border-t border-border/70 px-5 py-5">
          <h3 className={cn(H3, 'flex items-center gap-2')}>
            Containers
            <span className="rounded-md bg-muted px-1.5 py-px text-[11.5px] font-medium tabular-nums text-muted-foreground">{containers.length}</span>
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {containers.map((c, i) => (
              <li key={i} className="rounded-lg border border-border/70 px-3 py-2">
                <p className="font-mono text-[13px] font-medium">{c.number}</p>
                <p className="text-[12px] text-muted-foreground">{[c.type, c.sealNumber && `Seal ${c.sealNumber}`].filter(Boolean).join(' · ') || 'No type'}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
