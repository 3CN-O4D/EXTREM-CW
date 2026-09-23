// Row shapes mirroring the Postgres schema in supabase/migrations/20260922_init.sql.
// Enum columns (role, category, tip_method) are stored with UPPERCASE labels;
// the API uses lowercase values.

export interface UserRow {
  id: number;
  full_name: string | null;
  abbreviation: string;
  hashed_password: string;
  role: string; // 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  is_active: boolean;
  payable_balance: number;
  debt_balance: number;
}

export interface TxRow {
  id: number;
  timestamp: Date;
  washer_id: number | null;
  category: string; // 'BICYCLE' | ... | 'CARPET' | 'OTHER'
  expected_price: number;
  cash_paid: number;
  mpesa_paid: number;
  mpesa_transaction_id: string | null;
  mpesa_sender_name: string | null;
  manual_tip: number;
  tip_method: string; // 'CASH' | 'WAGES'
  misc_amount: number;
  misc_description: string | null;
  has_car_wash: boolean;
  has_vacuum: boolean;
  has_engine_wash: boolean;
  plate_number: string | null;
  customer_phone: string | null;
  custom_category: string | null;
  carpet_characteristics: string | null;
  receiver_id: number | null;
  total_paid: number;
  isolated_tip: number;
  net_business_remittance: number;
  shortfall: number;
  calculated_commission: number;
  net_wage_before_tip: number;
  final_payout: number;
  week_id: string;
}

export interface ExpenseRow {
  id: number;
  timestamp: Date;
  description: string;
  amount: number;
  category: string;
  week_id: string;
  transaction_id: number | null;
}

export interface RepaymentRow {
  id: number;
  timestamp: Date;
  employee_id: number;
  amount: number;
  week_id: string;
}

export interface DebtRow {
  id: number;
  employee_id: number;
  amount: number;
  service: string | null;
  date: Date;
  paid: number;
  paid_date: Date | null;
  notes: string | null;
}

export interface CarpetRow {
  id: number;
  created_at: Date;
  receiver_id: number;
  characteristics: string | null;
  client_name: string | null;
  customer_phone: string | null;
  image_data: string | null;
  expected_price: number;
  cash_paid: number;
  mpesa_paid: number;
  is_washed: boolean;
  status: string; // 'received' | 'released'
  released_at: Date | null;
}

export const SERVICE_CATEGORIES = [
  'bicycle', 'motorcycle', 'taxi', 'car', 'midrange', 'lorry', 'carpet', 'other',
];
export const TIP_METHODS = ['cash', 'wages'];
export const ROLES = ['admin', 'manager', 'employee'];