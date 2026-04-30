/**
 * Step 5 — Invoices & Items.
 *
 * Each manifest contains one or more invoices; each invoice contains one or
 * more items. Trade-compliance fields (aluminum/steel/copper %, exemption
 * flags) are tucked into a per-item Advanced accordion to keep the primary
 * form focused on the ~8 fields most items need.
 */
import { Plus, Trash2, Users } from 'lucide-react';
import type {
  ABIDocumentDraft,
  ABIInvoice,
  ABIItem,
  ABIParty,
  AbiDocument,
} from '@/api/client';
import { PARTY_TYPES, WEIGHT_UOM, YES_NO } from '@/data/abiEnums';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  COUNTRIES,
  CURRENCIES,
  DateField,
  SelectField,
  TextField,
  US_STATES,
} from './shared';

interface Props {
  value: ABIDocumentDraft;
  onChange: (patch: ABIDocumentDraft) => void;
  doc?: AbiDocument;
  errors?: Record<string, string>;
}

type PartialInvoice = Partial<ABIInvoice>;
type PartialItem = Partial<ABIItem>;
type PartialParty = Partial<ABIParty>;

const emptyItem = (): PartialItem => ({
  sku: '',
  htsNumber: '',
  description: '',
  origin: { country: '' },
  values: { currency: 'USD', exchangeRate: 1, totalValueOfGoods: 0 },
  quantity1: '',
  weight: { gross: '', uom: 'K' },
  parties: [],
});

const emptyInvoice = (): PartialInvoice => ({
  purchaseOrder: '',
  invoiceNumber: '',
  exportDate: '',
  relatedParties: 'N',
  countryOfExport: '',
  currency: 'USD',
  exchangeRate: 1,
  items: [emptyItem() as ABIItem],
});

function ConfirmDelete({
  label,
  onConfirm,
  description,
}: {
  label: string;
  onConfirm: () => void;
  description: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive h-7 px-2"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {label.toLowerCase()}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Step5Invoices({ value, onChange, errors = {} }: Props) {
  const manifest = (value.manifest?.[0] || {}) as NonNullable<
    ABIDocumentDraft['manifest']
  >[number];
  const invoices: PartialInvoice[] = (manifest.invoices || []) as PartialInvoice[];

  const writeManifest = (
    patch: Partial<NonNullable<ABIDocumentDraft['manifest']>[number]>,
  ) => {
    const rest = value.manifest ? value.manifest.slice(1) : [];
    onChange({
      manifest: [
        { ...manifest, ...patch } as (typeof manifest),
        ...rest,
      ] as ABIDocumentDraft['manifest'],
    });
  };

  const setInvoices = (next: PartialInvoice[]) =>
    writeManifest({
      invoices: next as NonNullable<typeof manifest.invoices>,
    });

  const updateInvoice = (idx: number, patch: PartialInvoice) => {
    const next = [...invoices];
    next[idx] = { ...next[idx], ...patch };
    setInvoices(next);
  };

  const addInvoice = () =>
    setInvoices([...invoices, emptyInvoice() as PartialInvoice]);
  const removeInvoice = (idx: number) =>
    setInvoices(invoices.filter((_, i) => i !== idx));

  const updateItem = (
    invIdx: number,
    itemIdx: number,
    patch: PartialItem,
  ) => {
    const inv = invoices[invIdx];
    const items = (inv?.items || []).slice() as PartialItem[];
    items[itemIdx] = { ...items[itemIdx], ...patch };
    updateInvoice(invIdx, { items: items as ABIItem[] });
  };

  const addItem = (invIdx: number) => {
    const inv = invoices[invIdx];
    const items = ((inv?.items || []) as PartialItem[]).concat([emptyItem()]);
    updateInvoice(invIdx, { items: items as ABIItem[] });
  };

  const removeItem = (invIdx: number, itemIdx: number) => {
    const inv = invoices[invIdx];
    const items = ((inv?.items || []) as PartialItem[]).filter(
      (_, i) => i !== itemIdx,
    );
    updateInvoice(invIdx, { items: items as ABIItem[] });
  };

  const updateParty = (
    invIdx: number,
    itemIdx: number,
    partyIdx: number,
    patch: PartialParty,
  ) => {
    const item = (invoices[invIdx]?.items?.[itemIdx] || {}) as PartialItem;
    const parties = ((item.parties || []) as PartialParty[]).slice();
    parties[partyIdx] = { ...parties[partyIdx], ...patch };
    updateItem(invIdx, itemIdx, { parties: parties as ABIParty[] });
  };

  const addParty = (invIdx: number, itemIdx: number) => {
    const item = (invoices[invIdx]?.items?.[itemIdx] || {}) as PartialItem;
    const parties = ((item.parties || []) as PartialParty[]).concat([
      { type: 'manufacturer', name: '' } as PartialParty,
    ]);
    updateItem(invIdx, itemIdx, { parties: parties as ABIParty[] });
  };

  const removeParty = (invIdx: number, itemIdx: number, partyIdx: number) => {
    const item = (invoices[invIdx]?.items?.[itemIdx] || {}) as PartialItem;
    const parties = ((item.parties || []) as PartialParty[]).filter(
      (_, i) => i !== partyIdx,
    );
    updateItem(invIdx, itemIdx, { parties: parties as ABIParty[] });
  };

  // Ensure at least one empty invoice exists so users have something to fill in.
  if (invoices.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          No invoices yet. Add the first invoice to begin entering line items.
        </div>
        <Button onClick={addInvoice}>
          <Plus className="h-4 w-4 mr-1.5" /> Add invoice
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Invoices & Items</h3>
          <p className="text-xs text-muted-foreground">
            One invoice per commercial invoice; one item per HTS line on each
            invoice.
          </p>
        </div>
        <Button onClick={addInvoice} size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add invoice
        </Button>
      </div>

      <div className="space-y-6">
        {invoices.map((inv, invIdx) => (
          <Card key={invIdx} className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Badge variant="secondary">Invoice {invIdx + 1}</Badge>
                  {inv.invoiceNumber && (
                    <span className="text-muted-foreground text-xs font-normal">
                      · {inv.invoiceNumber}
                    </span>
                  )}
                </CardTitle>
                {invoices.length > 1 && (
                  <ConfirmDelete
                    label="Remove invoice"
                    description={`This will delete invoice ${invIdx + 1} and all of its items. This cannot be undone.`}
                    onConfirm={() => removeInvoice(invIdx)}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Invoice header fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TextField
                  label="Purchase Order"
                  required
                  value={inv.purchaseOrder || ''}
                  onChange={(v) => updateInvoice(invIdx, { purchaseOrder: v })}
                  maxLength={35}
                  error={errors[`invoices.${invIdx}.purchaseOrder`]}
                />
                <TextField
                  label="Invoice Number"
                  required
                  value={inv.invoiceNumber || ''}
                  onChange={(v) => updateInvoice(invIdx, { invoiceNumber: v })}
                  maxLength={35}
                  error={errors[`invoices.${invIdx}.invoiceNumber`]}
                />
                <DateField
                  label="Export Date"
                  required
                  value={inv.exportDate || ''}
                  onChange={(v) => updateInvoice(invIdx, { exportDate: v })}
                  error={errors[`invoices.${invIdx}.exportDate`]}
                />
                <SelectField
                  label="Related Parties"
                  required
                  value="N"
                  onChange={() => {
                    /* Phase 1: locked to N */
                  }}
                  options={[{ value: 'N', label: 'No' }]}
                  disabled
                  hint="Phase 1 supports unrelated-party transactions only. Related-party (Y) reporting will unlock in a later phase."
                />
                <SelectField
                  label="Country of Export"
                  required
                  value={inv.countryOfExport || ''}
                  onChange={(v) => updateInvoice(invIdx, { countryOfExport: v })}
                  options={COUNTRIES}
                  error={errors[`invoices.${invIdx}.countryOfExport`]}
                />
                <SelectField
                  label="Invoice Currency"
                  required
                  value={inv.currency || 'USD'}
                  onChange={(v) => updateInvoice(invIdx, { currency: v })}
                  options={CURRENCIES}
                  error={errors[`invoices.${invIdx}.currency`]}
                />
                <TextField
                  label="Exchange Rate"
                  required
                  value={
                    inv.exchangeRate !== undefined
                      ? String(inv.exchangeRate)
                      : ''
                  }
                  onChange={(v) =>
                    updateInvoice(invIdx, {
                      exchangeRate: v === '' ? undefined : Number(v),
                    })
                  }
                  type="number"
                  hint="Invoice-currency to USD exchange rate (CC max: 8)."
                  error={errors[`invoices.${invIdx}.exchangeRate`]}
                />
              </div>

              {/* Items */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Line Items ({(inv.items || []).length})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addItem(invIdx)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add item
                  </Button>
                </div>
                <div className="space-y-4">
                  {((inv.items || []) as PartialItem[]).map((item, itemIdx) => {
                    const hts = (item.htsNumber || '').replace(/\D/g, '');
                    const itemPath = `invoices.${invIdx}.items.${itemIdx}`;
                    const htsError =
                      errors[`${itemPath}.htsNumber`] ??
                      (item.htsNumber && hts.length !== 10
                        ? 'HTS number must be exactly 10 digits'
                        : undefined);
                    return (
                      <div
                        key={itemIdx}
                        className="rounded-lg border bg-muted/10 p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            Item {itemIdx + 1}
                          </Badge>
                          {(inv.items || []).length > 1 && (
                            <ConfirmDelete
                              label="Remove item"
                              description={`This will delete item ${itemIdx + 1} from invoice ${invIdx + 1}.`}
                              onConfirm={() => removeItem(invIdx, itemIdx)}
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          <TextField
                            label="SKU / Part #"
                            required
                            value={item.sku || ''}
                            onChange={(v) =>
                              updateItem(invIdx, itemIdx, { sku: v })
                            }
                            maxLength={35}
                            error={errors[`${itemPath}.sku`]}
                          />
                          <TextField
                            label="HTS Number"
                            required
                            value={item.htsNumber || ''}
                            onChange={(v) =>
                              updateItem(invIdx, itemIdx, {
                                htsNumber: v.replace(/\D/g, '').slice(0, 10),
                              })
                            }
                            placeholder="1234567890"
                            maxLength={10}
                            error={htsError}
                            hint="10 digits, no dashes."
                          />
                          <TextField
                            label="Description"
                            required
                            value={item.description || ''}
                            onChange={(v) =>
                              updateItem(invIdx, itemIdx, { description: v })
                            }
                            maxLength={60}
                            error={errors[`${itemPath}.description`]}
                          />
                          <SelectField
                            label="Country of Origin"
                            required
                            value={item.origin?.country || ''}
                            onChange={(v) =>
                              updateItem(invIdx, itemIdx, {
                                origin: { country: v },
                              })
                            }
                            options={COUNTRIES}
                            error={errors[`${itemPath}.origin.country`]}
                          />
                          <SelectField
                            label="Item Currency"
                            required
                            value={item.values?.currency || 'USD'}
                            onChange={(v) =>
                              updateItem(invIdx, itemIdx, {
                                values: {
                                  ...(item.values || {
                                    exchangeRate: 1,
                                    totalValueOfGoods: 0,
                                  }),
                                  currency: v,
                                } as ABIItem['values'],
                              })
                            }
                            options={CURRENCIES}
                          />
                          <TextField
                            label="Exchange Rate"
                            required
                            value={
                              item.values?.exchangeRate !== undefined
                                ? String(item.values.exchangeRate)
                                : ''
                            }
                            onChange={(v) =>
                              updateItem(invIdx, itemIdx, {
                                values: {
                                  ...(item.values || {
                                    currency: 'USD',
                                    totalValueOfGoods: 0,
                                  }),
                                  exchangeRate:
                                    v === '' ? undefined : Number(v),
                                } as ABIItem['values'],
                              })
                            }
                            type="number"
                            hint="CC max: 8."
                            error={errors[`${itemPath}.values.exchangeRate`]}
                          />
                          <TextField
                            label="Total Value of Goods"
                            required
                            value={
                              item.values?.totalValueOfGoods !== undefined
                                ? String(item.values.totalValueOfGoods)
                                : ''
                            }
                            onChange={(v) =>
                              updateItem(invIdx, itemIdx, {
                                values: {
                                  ...(item.values || {
                                    currency: 'USD',
                                    exchangeRate: 1,
                                  }),
                                  totalValueOfGoods:
                                    v === '' ? undefined : Number(v),
                                } as ABIItem['values'],
                              })
                            }
                            type="number"
                            hint="In the item currency above."
                            error={errors[`${itemPath}.values.totalValueOfGoods`]}
                          />
                          <TextField
                            label="Quantity (Unit 1)"
                            required
                            value={item.quantity1 || ''}
                            onChange={(v) =>
                              updateItem(invIdx, itemIdx, { quantity1: v })
                            }
                            error={errors[`${itemPath}.quantity1`]}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <TextField
                              label="Gross Weight"
                              required
                              value={item.weight?.gross || ''}
                              onChange={(v) =>
                                updateItem(invIdx, itemIdx, {
                                  weight: {
                                    ...(item.weight || { uom: 'K' }),
                                    gross: v,
                                  } as ABIItem['weight'],
                                })
                              }
                              type="number"
                              error={errors[`${itemPath}.weight.gross`]}
                            />
                            <SelectField
                              label="Weight UOM"
                              required
                              value={item.weight?.uom || 'K'}
                              onChange={(v) =>
                                updateItem(invIdx, itemIdx, {
                                  weight: {
                                    ...(item.weight || { gross: '' }),
                                    uom: v,
                                  } as ABIItem['weight'],
                                })
                              }
                              options={WEIGHT_UOM}
                            />
                          </div>
                        </div>

                        {/* Parties per item */}
                        <div className="border-t pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-semibold flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              Parties
                            </h5>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addParty(invIdx, itemIdx)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Add party
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {((item.parties || []) as PartialParty[]).map(
                              (p, pIdx) => {
                                const partyIsUS = (p.country || '').toUpperCase() === 'US';
                                return (
                                <div
                                  key={pIdx}
                                  className="rounded-md border bg-background p-3 space-y-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Party {pIdx + 1}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive h-7 px-2"
                                      onClick={() =>
                                        removeParty(invIdx, itemIdx, pIdx)
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <SelectField
                                      label="Party Type"
                                      required
                                      value={p.type || ''}
                                      onChange={(v) =>
                                        updateParty(invIdx, itemIdx, pIdx, {
                                          type: v as ABIParty['type'],
                                        })
                                      }
                                      options={PARTY_TYPES}
                                    />
                                    <TextField
                                      label="Name"
                                      value={p.name || ''}
                                      onChange={(v) =>
                                        updateParty(invIdx, itemIdx, pIdx, {
                                          name: v,
                                        })
                                      }
                                      maxLength={35}
                                    />
                                    <TextField
                                      label="Tax ID"
                                      value={p.taxId || ''}
                                      onChange={(v) =>
                                        updateParty(invIdx, itemIdx, pIdx, {
                                          taxId: v,
                                        })
                                      }
                                      maxLength={20}
                                    />
                                    <TextField
                                      label="Address"
                                      value={p.address || ''}
                                      onChange={(v) =>
                                        updateParty(invIdx, itemIdx, pIdx, {
                                          address: v,
                                        })
                                      }
                                      maxLength={35}
                                    />
                                    <TextField
                                      label="City"
                                      value={p.city || ''}
                                      onChange={(v) =>
                                        updateParty(invIdx, itemIdx, pIdx, {
                                          city: v,
                                        })
                                      }
                                      maxLength={35}
                                    />
                                    {partyIsUS ? (
                                      <SelectField
                                        label="State"
                                        value={p.state || ''}
                                        onChange={(v) =>
                                          updateParty(invIdx, itemIdx, pIdx, {
                                            state: v,
                                          })
                                        }
                                        options={US_STATES}
                                      />
                                    ) : (
                                      <TextField
                                        label="State / Province"
                                        value={p.state || ''}
                                        onChange={(v) =>
                                          updateParty(invIdx, itemIdx, pIdx, {
                                            state: v,
                                          })
                                        }
                                        maxLength={20}
                                      />
                                    )}
                                    <TextField
                                      label="Postal Code"
                                      value={p.postalCode || ''}
                                      onChange={(v) =>
                                        updateParty(invIdx, itemIdx, pIdx, {
                                          postalCode: v,
                                        })
                                      }
                                      maxLength={10}
                                    />
                                    <SelectField
                                      label="Country"
                                      value={p.country || ''}
                                      onChange={(v) =>
                                        updateParty(invIdx, itemIdx, pIdx, {
                                          country: v,
                                        })
                                      }
                                      options={COUNTRIES}
                                    />
                                  </div>
                                </div>
                              );})}
                            {(!item.parties || item.parties.length === 0) && (
                              <p className="text-xs text-muted-foreground italic">
                                No parties added yet.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Advanced: trade-compliance fields */}
                        <Accordion
                          type="single"
                          collapsible
                          className="border-t pt-2"
                        >
                          <AccordionItem value="advanced" className="border-0">
                            <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2 hover:no-underline">
                              Advanced — trade compliance
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                <TextField
                                  label="Aluminum %"
                                  value={
                                    item.aluminumPercentage !== undefined
                                      ? String(item.aluminumPercentage)
                                      : ''
                                  }
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      aluminumPercentage:
                                        v === '' ? undefined : Number(v),
                                    })
                                  }
                                  type="number"
                                />
                                <TextField
                                  label="Steel %"
                                  value={
                                    item.steelPercentage !== undefined
                                      ? String(item.steelPercentage)
                                      : ''
                                  }
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      steelPercentage:
                                        v === '' ? undefined : Number(v),
                                    })
                                  }
                                  type="number"
                                />
                                <TextField
                                  label="Copper %"
                                  value={
                                    item.copperPercentage !== undefined
                                      ? String(item.copperPercentage)
                                      : ''
                                  }
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      copperPercentage:
                                        v === '' ? undefined : Number(v),
                                    })
                                  }
                                  type="number"
                                />
                                <SelectField
                                  label="Cotton Fee Exemption"
                                  value={item.cottonFeeExemption || ''}
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      cottonFeeExemption: v as 'Y' | 'N',
                                    })
                                  }
                                  options={YES_NO}
                                />
                                <SelectField
                                  label="Auto Parts Exemption"
                                  value={item.autoPartsExemption || ''}
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      autoPartsExemption: v as 'Y' | 'N',
                                    })
                                  }
                                  options={YES_NO}
                                />
                                <SelectField
                                  label="Non-kitchen Parts"
                                  value={
                                    item.otherThanCompletedKitchenParts || ''
                                  }
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      otherThanCompletedKitchenParts: v as
                                        | 'Y'
                                        | 'N',
                                    })
                                  }
                                  options={YES_NO}
                                />
                                <SelectField
                                  label="Informational Materials"
                                  value={
                                    item.informationalMaterialsExemption || ''
                                  }
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      informationalMaterialsExemption: v as
                                        | 'Y'
                                        | 'N',
                                    })
                                  }
                                  options={YES_NO}
                                />
                                <SelectField
                                  label="Religious Purposes"
                                  value={item.religiousPurposes || ''}
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      religiousPurposes: v as 'Y' | 'N',
                                    })
                                  }
                                  options={YES_NO}
                                />
                                <SelectField
                                  label="Agricultural Exemption"
                                  value={item.agriculturalExemption || ''}
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      agriculturalExemption: v as 'Y' | 'N',
                                    })
                                  }
                                  options={YES_NO}
                                />
                                <SelectField
                                  label="Semiconductor Exemption"
                                  value={
                                    item.semiConductorExemption !== undefined && item.semiConductorExemption !== null
                                      ? String(item.semiConductorExemption)
                                      : ''
                                  }
                                  onChange={(v) =>
                                    updateItem(invIdx, itemIdx, {
                                      semiConductorExemption: v === '' ? undefined : (Number(v) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9),
                                    })
                                  }
                                  options={[
                                    { value: '', label: '— None —' },
                                    { value: '1', label: '1' },
                                    { value: '2', label: '2' },
                                    { value: '3', label: '3' },
                                    { value: '4', label: '4' },
                                    { value: '5', label: '5' },
                                    { value: '6', label: '6' },
                                    { value: '7', label: '7' },
                                    { value: '8', label: '8' },
                                    { value: '9', label: '9' },
                                  ]}
                                  hint="CC accepts 1–9 or none. 0 is rejected."
                                />
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
