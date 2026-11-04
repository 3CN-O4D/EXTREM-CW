import { addDays, format } from 'date-fns';
import { Printer } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  bicycle: 'Bicycle',
  motorcycle: 'Motorcycle',
  taxi: 'Taxi',
  car: 'Car',
  midrange: 'Midrange',
  lorry: 'Lorry',
  carpet: 'Carpet',
  vacuum: 'Vacuum',
  engine: 'Engine wash',
  exterior: 'Exterior wash',
  other: 'Other',
};

const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x) : 0;
};

export interface DayStatsProps {
  summary: any;
  carpets: any;
  selectedDay: Date;
  weekStart: Date;
  mode: 'day' | 'week';
}

export default function DayStats({ summary, carpets, selectedDay, weekStart, mode }: DayStatsProps) {
  if (!summary) return null;

  const cash = n(summary.total_cash_received);
  const mpesa = n(summary.total_mpesa_received);
  const expenses = n(summary.total_expenses);
  const netCash = cash - expenses;
  const paid = cash + mpesa;
  const staffDebts = n(summary.total_debts);
  const clientDebts = n(summary.total_client_debts);

  const carpetIn = mode === 'day' ? n(carpets?.day?.received) : n(carpets?.week?.received);
  const carpetOut = mode === 'day' ? n(carpets?.day?.released) : n(carpets?.week?.released);
  const carpetLeft = mode === 'day' ? n(carpets?.day?.remaining) : n(carpets?.week?.remaining);

  const counts: Array<[string, number]> = Object.entries(summary.category_counts || {})
    .map(([cat, count]) => [cat, n(count)] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  const jobs = counts.reduce((sum, [, count]) => sum + count, 0);

  const labor: any[] = summary.labor_breakdown || [];
  const grossWages = labor.reduce((sum, e) => sum + n(e.gross), 0);
  const withheld = labor.reduce((sum, e) => sum + n(e.shortfall), 0);
  const netWages = labor.reduce((sum, e) => sum + n(e.wages), 0);

  const tiles = [
    { label: 'Cash', value: `Ksh ${cash}`, cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'M-Pesa', value: `Ksh ${mpesa}`, cls: 'text-brand-600 dark:text-brand-300' },
    { label: 'Total paid', value: `Ksh ${paid}`, cls: 'text-slate-900 dark:text-white' },
    { label: 'Expenses', value: `Ksh ${expenses}`, cls: 'text-red-600 dark:text-red-400' },
    {
      label: 'Net wages',
      value: `Ksh ${netWages}`,
      cls: netWages < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
      hint: `gross ${grossWages} · withheld ${withheld}`,
    },
    {
      label: 'Net cash',
      value: `Ksh ${netCash}`,
      cls: netCash >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      hint: `Cash ${cash} − expenses ${expenses}`,
    },
    { label: 'Carpets in', value: `${carpetIn}`, cls: 'text-blue-600 dark:text-blue-400' },
    { label: 'Carpets out', value: `${carpetOut}`, cls: 'text-violet-600 dark:text-violet-300' },
    { label: 'Carpets remaining', value: `${carpetLeft}`, cls: 'text-cyan-600 dark:text-cyan-400' },
    {
      label: 'Staff debts',
      value: `Ksh ${staffDebts}`,
      cls: staffDebts > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white',
    },
    {
      label: 'Client debts',
      value: `Ksh ${clientDebts}`,
      cls: clientDebts > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white',
    },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
        <div>
          <h2 className="section-title">
            {mode === 'day'
              ? `Day stats — ${format(selectedDay, 'EEE dd MMM yyyy')}`
              : `Week stats — ${format(weekStart, 'dd MMM')} – ${format(addDays(weekStart, 4), 'dd MMM yyyy')}`}
          </h2>
          <p className="muted text-xs">
            {mode === 'day'
              ? 'Everything recorded for this day, in one place.'
              : 'Totals for the selected week.'}
          </p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary btn-sm print:hidden">
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="stat-grid p-4 xl:grid-cols-5">
        {tiles.map((s) => (
          <div key={s.label} className="stat-tile">
            <p className="stat-label">{s.label}</p>
            <p className={`stat-value ${s.cls}`}>{s.value}</p>
            {'hint' in s && s.hint ? (
              <p className="mt-0.5 truncate text-[10px] text-slate-400">{s.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-0 border-t border-slate-200/80 dark:border-white/10 lg:grid-cols-2">
        {/* Items breakdown */}
        <div className="border-b border-slate-200/80 dark:border-white/10 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <h3 className="text-sm font-black tracking-tight">Items breakdown</h3>
              <p className="muted text-xs">{jobs} job{jobs === 1 ? '' : 's'} logged</p>
            </div>
          </div>
          {counts.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-400">No items recorded.</p>
          ) : (
            <div className="table-wrap">
              <table className="table-clean min-w-0">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map(([cat, count]) => (
                    <tr key={cat}>
                      <td className="font-medium capitalize">{CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ')}</td>
                      <td className="text-right font-mono font-bold">{count}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black dark:bg-white/5">
                    <td>Total</td>
                    <td className="text-right font-mono">{jobs}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Employee earnings and shortfalls */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <div>
              <h3 className="text-sm font-black tracking-tight">Employee earnings</h3>
              <p className="muted text-xs">Gross wages {grossWages} · withheld {withheld} · net {netWages}</p>
            </div>
          </div>
          {labor.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-400">No wages recorded for this period.</p>
          ) : (
            <div className="table-wrap">
              <table className="table-clean min-w-0">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">Shortfall</th>
                    <th className="text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {labor.map((e) => {
                    const net = n(e.wages);
                    return (
                      <tr key={`${e.name}-${e.abbreviation}`}>
                        <td>
                          <p className="font-medium">{e.name}</p>
                          {e.abbreviation ? <p className="text-[11px] text-slate-400">{e.abbreviation}</p> : null}
                        </td>
                        <td className="text-right font-mono">{n(e.gross)}</td>
                        <td className={`text-right font-mono ${n(e.shortfall) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                          {n(e.shortfall)}
                        </td>
                        <td className={`text-right font-mono font-bold ${net < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {net}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-black dark:bg-white/5">
                    <td>Total</td>
                    <td className="text-right font-mono">{grossWages}</td>
                    <td className="text-right font-mono text-red-600 dark:text-red-400">{withheld}</td>
                    <td className="text-right font-mono">{netWages}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
