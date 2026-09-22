export interface ParsedPaymentSms {
  source: 'mpesa' | 'bank';
  senderName: string;
  amount: number;
  transactionId: string;
  date?: string;
}

const BANK_RE = /Dear\s+[^\n]+?\s+a transaction of\s+KES\s+([\d,]+(?:\.\d{2})?)\s+for\s+(\d+)\s+has been received from\s+([A-Z][A-Z0-9 .'-]+?)\s+(?:on\s+)?\d{1,2}\/\d{1,2}\/\d{2,4}/i;
const BANK_REF_RE = /M-Pesa Ref:\s*([A-Z0-9]+)/i;

const MPESA_CONFIRMED_RE = /You have received\s+Ksh([\d,]+(?:\.\d{2})?)\s+from\s+([A-Z][A-Za-z .'-]+?)\s+(?:\d{4}\*{3}\d{3}|\d{1,2}\/\d{1,2}\/\d{2,4})/i;
const MPESA_REF_RE = /([A-Z0-9]{10})\s+Confirmed/i;

const AMOUNT_ONLY_RE = /(?:KES|Ksh)\s?([\d,]+(?:\.\d{2})?)/i;

function cleanName(raw: string): string {
  const name = raw.trim();
  const allLower = /^[\p{Ll}0-9 .'&-]+$/u.test(name);
  return allLower ? name : name.replace(/\s+[\p{Ll}]+\s*$/u, '');
}

export function parsePaymentSms(message: string): ParsedPaymentSms | null {
  if (!message || message.trim().length < 30) return null;

  const isBlock4 = /\bDear\b/i.test(message) && /transaction of/i.test(message);
  const isConfirmed = /Confirmed/i.test(message) && /received/i.test(message);

  if (isBlock4) {
    const m = message.match(BANK_RE);
    const ref = message.match(BANK_REF_RE);
    if (m && ref) {
      return {
        source: message.includes('NCBA') ? 'bank' : 'mpesa',
        senderName: cleanName(m[3]),
        amount: parseFloat(m[1].replace(/,/g, '')),
        transactionId: ref[1],
      };
    }
    if (ref) {
      const name = message.match(/has been received from\s+([A-Z][A-Z0-9 .'-]+?)(?:\s|$)/i);
      const amt = extractAmount(message);
      if (name && amt !== null) {
        return { source: message.includes('NCBA') ? 'bank' : 'mpesa', senderName: cleanName(name[1]), amount: amt, transactionId: ref[1] };
      }
    }
  }

  if (isConfirmed) {
    const m = message.match(MPESA_CONFIRMED_RE);
    const ref = message.match(MPESA_REF_RE);
    if (m && ref) {
      return {
        source: 'mpesa',
        senderName: cleanName(m[2]),
        amount: parseFloat(m[1].replace(/,/g, '')),
        transactionId: ref[1],
      };
    }
  }

  return null;
}

export function extractAmount(message: string): number | null {
  const m = message.match(AMOUNT_ONLY_RE);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}