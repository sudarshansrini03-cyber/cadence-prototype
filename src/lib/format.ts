export const TODAY = '2026-11-23';
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const lakh = (n: number) => (n >= 100000 ? '₹ ' + (n / 100000).toFixed(1) + ' L' : inr(n));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
/** days past the due date as of TODAY (negative = not yet due) */
export const daysOverdue = (due: string) => Math.round(day(TODAY) - day(due));
