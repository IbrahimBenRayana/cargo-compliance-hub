export type Mode = 'standard' | 'ai';

export const MAX_ITEMS = 50;

/** One line of goods as typed; numbers stay strings until the request is built. */
export interface ItemDraft {
  hts: string;
  description: string;
  totalValue: string;
  quantity1: string;
  quantity2: string;
  spi: string;
  aluminumPercentage: string;
  steelPercentage: string;
  copperPercentage: string;
  isCottonExempt: boolean;
  isAutoPartExempt: boolean;
  kitchenPartNotComplete: boolean;
  isInformationalMaterialExempt: boolean;
}

export const emptyItem = (): ItemDraft => ({
  hts: '',
  description: '',
  totalValue: '',
  quantity1: '',
  quantity2: '',
  spi: '',
  aluminumPercentage: '',
  steelPercentage: '',
  copperPercentage: '',
  isCottonExempt: false,
  isAutoPartExempt: false,
  kitchenPartNotComplete: false,
  isInformationalMaterialExempt: false,
});
