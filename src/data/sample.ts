import type { Invoice, Payment, Shop, State } from '../types';

export const DISTRIBUTOR = 'ABC Distributors (sample)';
export const UPI_ID = 'abc.distributors@upi';
/** Money owed by customers that are not shown in this demo, so the owner totals read like a real book. */
export const OTHER_CUSTOMERS = [2905000, 900000, 500000];
export const COLLECTED_BASE = 240000;

const i = (no: string, shop: string, date: string, due: string, amount: number, paid = 0): Invoice => ({ no, shop, date, due, amount, paid });

export const SAMPLE_SHOPS: Shop[] = [
  { name: 'Lakshmi Stores', status: 'Promised 25 Nov', promised: '2026-11-25' },
  { name: 'Ganesh Provisions', status: 'No reply yet' },
  { name: 'Annapoorna Traders', status: 'Part-paid ₹40,000' },
  { name: 'Mahadev Agencies', status: 'Reminder sent', reminded: true },
  { name: 'Sri Balaji Kirana', status: 'Not yet due' },
  { name: 'Kaveri Mart', status: 'Not yet due' },
];

export const SAMPLE_INVOICES: Invoice[] = [
  i('1018', 'Lakshmi Stores', '2026-09-02', '2026-10-02', 60000),
  i('1024', 'Lakshmi Stores', '2026-09-20', '2026-10-20', 75000),
  i('1033', 'Lakshmi Stores', '2026-10-10', '2026-11-09', 45000),
  i('1021', 'Ganesh Provisions', '2026-09-13', '2026-10-13', 70000),
  i('1035', 'Ganesh Provisions', '2026-10-13', '2026-11-12', 50000),
  i('1022', 'Annapoorna Traders', '2026-09-16', '2026-10-16', 130000, 40000),
  i('1026', 'Mahadev Agencies', '2026-09-21', '2026-10-21', 45000),
  i('1037', 'Mahadev Agencies', '2026-10-17', '2026-11-16', 25000),
  i('1039', 'Sri Balaji Kirana', '2026-10-06', '2026-11-05', 55000),
  i('1040', 'Kaveri Mart', '2026-10-15', '2026-11-14', 3500),
  i('1042', 'Kaveri Mart', '2026-11-10', '2026-11-25', 36500),
];

export const SAMPLE_PAYMENTS: Payment[] = [
  { id: 'p1', ref: '3318402917', payer: 'Lakshmi Stores', amount: 60000, time: '9:42 am', state: 'pending' },
  { id: 'p2', ref: '3318455102', payer: 'Sri Venkateshwara Stores', amount: 25000, time: '10:05 am', state: 'pending' },
  { id: 'p3', ref: '3318490066', payer: 'Mahadev Agencies', amount: 45000, time: '10:31 am', state: 'pending' },
  { id: 'p4', ref: '3318533471', payer: 'Ganesh P.', amount: 120000, time: '11:02 am', state: 'pending' },
  { id: 'p5', ref: '3318561820', payer: 'Annapoorna Trdrs', amount: 35000, time: '11:20 am', state: 'pending' },
  { id: 'p6', ref: '3318577304', payer: 'R. Kumar', amount: 30000, time: '11:36 am', state: 'pending' },
];

export const initialState = (): State => ({
  shops: SAMPLE_SHOPS.map((s) => ({ ...s })),
  invoices: SAMPLE_INVOICES.map((x) => ({ ...x })),
  payments: SAMPLE_PAYMENTS.map((p) => ({ ...p })),
  lang: 'en',
  selectedShop: 'Ganesh Provisions',
});
