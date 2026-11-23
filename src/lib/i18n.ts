import type { Lang } from '../types';
import { DISTRIBUTOR } from '../data/sample';
import { fmtDate, inr } from './format';

const T = {
  en: {
    hi: 'Namaste!',
    body: (inv: string, amt: string, d: string, past: boolean) => `A friendly reminder: invoice ${inv} for ${amt} ${past ? 'was' : 'is'} due on ${d}. Thank you for your business.`,
    upi: 'Pay with UPI',
    date: 'I will pay on a date',
    call: 'Please call me',
    simulatePay: 'Simulate payment received',
    confirm: 'Confirm',
  },
  hi: {
    hi: 'नमस्ते!',
    body: (inv: string, amt: string, d: string, past: boolean) => `एक छोटी सी याद दिलाना: बिल ${inv} की रकम ${amt} की देय तिथि ${d} ${past ? 'थी' : 'है'}। आपके सहयोग के लिए धन्यवाद।`,
    upi: 'UPI से भुगतान करें',
    date: 'मैं तारीख बताऊँगा',
    call: 'कृपया मुझे कॉल करें',
    simulatePay: 'भुगतान प्राप्त का अनुकरण करें',
    confirm: 'पुष्टि करें',
  },
  kn: {
    hi: 'ನಮಸ್ಕಾರ!',
    body: (inv: string, amt: string, d: string, past: boolean) => `ಸ್ನೇಹಪೂರ್ವಕ ಜ್ಞಾಪನೆ: ಬಿಲ್ ${inv}, ಮೊತ್ತ ${amt}, ಪಾವತಿ ದಿನಾಂಕ ${d} ${past ? 'ಆಗಿತ್ತು' : 'ಆಗಿದೆ'}. ನಿಮ್ಮ ವ್ಯಾಪಾರಕ್ಕೆ ಧನ್ಯವಾದಗಳು.`,
    upi: 'UPI ಮೂಲಕ ಪಾವತಿಸಿ',
    date: 'ನಾನು ದಿನಾಂಕದಂದು ಪಾವತಿಸುತ್ತೇನೆ',
    call: 'ದಯವಿಟ್ಟು ಕರೆ ಮಾಡಿ',
    simulatePay: 'ಪಾವತಿ ಸ್ವೀಕರಿಸಿದ ಅನುಕರಣೆ',
    confirm: 'ದೃಢೀಕರಿಸಿ',
  },
} as const;

export const LANGS: { id: Lang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'hi', label: 'हिन्दी' }, { id: 'kn', label: 'ಕನ್ನಡ' }];

export function reminderText(lang: Lang, inv: { no: string; due: string }, amount: number, past: boolean) {
  const t = T[lang];
  return `${t.hi} ${t.body(inv.no, inr(amount), fmtDate(inv.due), past)} - ${DISTRIBUTOR}`;
}
export const labels = (lang: Lang) => T[lang];
