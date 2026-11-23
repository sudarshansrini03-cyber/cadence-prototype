export type Lang = 'en' | 'hi' | 'kn';
export interface Invoice { no: string; shop: string; date: string; due: string; amount: number; paid: number }
export interface Shop { name: string; status: string; promised?: string; askedCall?: boolean; reminded?: boolean }
export type PayState = 'pending' | 'matched' | 'review' | 'confirmed';
export interface Payment {
  id: string; ref: string; payer: string; amount: number; time: string;
  state: PayState; shop?: string; invoices?: string[]; how?: string;
}
export interface State {
  shops: Shop[];
  invoices: Invoice[];
  payments: Payment[];
  lang: Lang;
  selectedShop?: string;
}

