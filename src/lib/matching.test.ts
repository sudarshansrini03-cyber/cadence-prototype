import { describe, expect, it } from 'vitest';
import { allocate, autoMatch, nameMatches } from './matching';
import type { Invoice } from '../types';

const inv = (no: string, shop: string, due: string, amount: number, paid = 0): Invoice => ({ no, shop, date: '2026-09-01', due, amount, paid });
const book: Invoice[] = [
  inv('1', 'Lakshmi Stores', '2026-10-02', 60000),
  inv('2', 'Lakshmi Stores', '2026-11-09', 45000),
  inv('3', 'Mahadev Agencies', '2026-10-21', 45000),
  inv('4', 'Mahadev Agencies', '2026-11-16', 25000),
  inv('5', 'Ganesh Provisions', '2026-10-13', 70000),
  inv('6', 'Ganesh Provisions', '2026-11-12', 50000),
  inv('7', 'Annapoorna Traders', '2026-10-16', 130000, 40000),
];

describe('autoMatch', () => {
  it('matches a unique exact amount even if the payer name differs', () => {
    const r = autoMatch({ payer: 'Sri Venkateshwara Stores', amount: 25000 }, book);
    expect(r.kind).toBe('exact'); expect(r.invoices).toEqual(['4']);
  });
  it('uses the payer name when two bills have the same amount', () => {
    const r = autoMatch({ payer: 'Mahadev Agencies', amount: 45000 }, book);
    expect(r.kind).toBe('name'); expect(r.shop).toBe('Mahadev Agencies'); expect(r.invoices).toEqual(['3']);
  });
  it('matches a payment that settles several oldest bills of one shop', () => {
    const r = autoMatch({ payer: 'Ganesh P.', amount: 120000 }, book);
    expect(r.kind).toBe('name'); expect(r.invoices).toEqual(['5', '6']);
  });
  it('sends a name match with a non-fitting amount to a person', () => {
    const r = autoMatch({ payer: 'Annapoorna Trdrs', amount: 35000 }, book);
    expect(r.kind).toBe('review'); expect(r.shop).toBe('Annapoorna Traders');
  });
  it('sends an unknown payer and amount to a person', () => {
    expect(autoMatch({ payer: 'R. Kumar', amount: 30000 }, book).kind).toBe('review');
  });
});

describe('helpers', () => {
  it('compares names loosely', () => {
    expect(nameMatches('Ganesh P.', 'Ganesh Provisions')).toBe(true);
    expect(nameMatches('R. Kumar', 'Lakshmi Stores')).toBe(false);
  });
  it('allocates oldest first and carries over', () => {
    const r = allocate(book, 'Lakshmi Stores', 80000);
    expect(r.applied).toEqual(['1', '2']);
    expect(r.invoices.find((i) => i.no === '2')!.paid).toBe(20000);
  });
});
