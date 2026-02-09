export interface ServiceDoc {
  key: string;
  label: string;
  hint?: string;
  accept?: string;
}

export interface ServiceDef {
  key: string;
  name: string;
  requiredDocs: ServiceDoc[];
}

export const SERVICES: ServiceDef[] = [
  {
    key: 'individual_1040',
    name: 'Individual Tax Filing (Form 1040)',
    requiredDocs: [
      { key: 'identity', label: 'Photo ID (Passport / Driver’s License)', accept: 'image/*,application/pdf' },
      { key: 'w2', label: 'W-2 (if applicable)', accept: 'application/pdf,image/*' },
      { key: '1099', label: '1099s (1099-NEC/INT/DIV/etc.)', accept: 'application/pdf,image/*' },
      { key: 'prior_return', label: 'Prior-year tax return (if available)', accept: 'application/pdf,image/*' },
    ],
  },
  {
    key: 'itin',
    name: 'ITIN Application',
    requiredDocs: [
      { key: 'passport', label: 'Passport / National ID', accept: 'image/*,application/pdf' },
      { key: 'itin_support', label: 'Supporting documents (as applicable)', accept: 'application/pdf,image/*' },
    ],
  },
  {
    key: 'fbar_fatca',
    name: 'FBAR / FATCA',
    requiredDocs: [
      { key: 'bank_statements', label: 'Bank statements / account details', accept: 'application/pdf,image/*' },
      { key: 'account_summary', label: 'Account summary (highest balance)', accept: 'application/pdf,image/*' },
    ],
  },
  {
    key: 'business',
    name: 'Business Tax Filing',
    requiredDocs: [
      { key: 'ein_letter', label: 'EIN confirmation letter (if available)', accept: 'application/pdf,image/*' },
      { key: 'financials', label: 'Financial statements / books', accept: 'application/pdf,image/*' },
      { key: 'payroll', label: 'Payroll reports (if applicable)', accept: 'application/pdf,image/*' },
    ],
  },
  {
    key: 'amendment',
    name: 'Tax Return Amendment',
    requiredDocs: [
      { key: 'original_return', label: 'Original filed return', accept: 'application/pdf,image/*' },
      { key: 'amendment_reason', label: 'Documents supporting the amendment', accept: 'application/pdf,image/*' },
    ],
  },
];

export function getServiceByKey(key: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.key === key);
}

