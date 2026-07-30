import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Wallet,
  ReceiptText,
  PiggyBank,
  Gauge,
  ChevronDown,
  Building2,
} from "lucide-react";

/**
 * MOOE Expenses Monitoring System — Statistics
 * -------------------------------------------------
 * A read-only analytics view summarizing Maintenance and Other
 * Operating Expenses (MOOE) budget utilization for a given period.
 *
 * Stack: React + TypeScript + Tailwind CSS + recharts + lucide-react
 */

// ---------- Types ----------

interface MonthlyPoint {
  month: string;
  budget: number;
  disbursed: number;
}

interface CategoryBreakdown {
  name: string;
  amount: number;
}

type BudgetStatus = "Within Budget" | "Near Limit" | "Over Budget";

interface OfficeRow {
  office: string;
  allocated: number;
  disbursed: number;
}

// ---------- Mock data (swap with API data) ----------

const MONTHLY_DATA: MonthlyPoint[] = [
  { month: "Jan", budget: 480000, disbursed: 402500 },
  { month: "Feb", budget: 480000, disbursed: 431200 },
  { month: "Mar", budget: 480000, disbursed: 468900 },
  { month: "Apr", budget: 480000, disbursed: 397300 },
  { month: "May", budget: 480000, disbursed: 455100 },
  { month: "Jun", budget: 480000, disbursed: 412800 },
  { month: "Jul", budget: 480000, disbursed: 388600 },
];

const CATEGORY_DATA: CategoryBreakdown[] = [
  { name: "Utilities (Water & Electricity)", amount: 812400 },
  { name: "Repairs & Maintenance", amount: 534200 },
  { name: "Office Supplies", amount: 398700 },
  { name: "Travel Expenses", amount: 276500 },
  { name: "Training & Seminars", amount: 231900 },
  { name: "Communication", amount: 168300 },
];

const OFFICE_ROWS: OfficeRow[] = [
  { office: "Office of the Administrator", allocated: 620000, disbursed: 589400 },
  { office: "Finance & Budget Division", allocated: 410000, disbursed: 233900 },
  { office: "General Services Unit", allocated: 505000, disbursed: 498100 },
  { office: "Human Resources Division", allocated: 260000, disbursed: 141200 },
  { office: "Records Management Office", allocated: 180000, disbursed: 172550 },
];

const CHART_COLORS = ["#0f766e", "#0891b2", "#b45309", "#78716c", "#4d7c0f", "#334155"];

const PERIODS = ["Q1 2026", "Q2 2026", "Q3 2026", "Full Year 2026"];

// ---------- Helpers ----------

const peso = (value: number): string =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

const pct = (value: number): string => `${value.toFixed(1)}%`;

function getStatus(utilization: number): BudgetStatus {
  if (utilization >= 100) return "Over Budget";
  if (utilization >= 90) return "Near Limit";
  return "Within Budget";
}

const STATUS_STYLES: Record<BudgetStatus, string> = {
  "Within Budget": "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "Near Limit": "bg-amber-50 text-amber-700 ring-amber-600/20",
  "Over Budget": "bg-rose-50 text-rose-700 ring-rose-600/20",
};

// ---------- Small presentational pieces ----------

const KpiCard: React.FC<{
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}> = ({ label, value, sub, icon }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="rounded-md bg-slate-50 p-2 text-slate-500 ring-1 ring-slate-200">
        {icon}
      </div>
    </div>
    <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-slate-900">
      {value}
    </p>
    <p className="mt-1 text-xs text-slate-500">{sub}</p>
  </div>
);

const LedgerRow: React.FC<{ name: string; amount: number; total: number }> = ({
  name,
  amount,
  total,
}) => {
  const share = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="whitespace-nowrap text-sm text-slate-700">{name}</span>
        <span className="flex-1 border-b border-dotted border-slate-300 translate-y-[-3px]" />
        <span className="whitespace-nowrap font-mono text-sm tabular-nums text-slate-900">
          {peso(amount)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-700"
          style={{ width: `${Math.min(share, 100)}%` }}
        />
      </div>
    </div>
  );
};

// ---------- Main component ----------

interface MOOEStatisticsProps {
  onSecretTap?: () => void;
}

const MOOEStatistics: React.FC<MOOEStatisticsProps> = ({ onSecretTap }) => {
  const [period, setPeriod] = useState<string>(PERIODS[3]);
  const [periodOpen, setPeriodOpen] = useState<boolean>(false);

  // Triple-tap secret redirect
  const tapCountRef = React.useRef(0);
  const tapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      onSecretTap?.();
      return;
    }

    // Reset count if the next tap doesn't come within 600 ms
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 600);
  };

  const totals = useMemo(() => {
    const budget = MONTHLY_DATA.reduce((sum, m) => sum + m.budget, 0);
    const disbursed = MONTHLY_DATA.reduce((sum, m) => sum + m.disbursed, 0);
    const remaining = budget - disbursed;
    const utilization = (disbursed / budget) * 100;
    return { budget, disbursed, remaining, utilization };
  }, []);

  const categoryTotal = useMemo(
    () => CATEGORY_DATA.reduce((sum, c) => sum + c.amount, 0),
    []
  );

  return (
    <div className="min-h-full w-full bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="cursor-default select-none text-xs font-semibold uppercase tracking-widest text-teal-700"
              onClick={handleTitleTap}
            >
              MOOE Expenses Monitoring System
            </p>
            <h1 className="mt-1 font-mono text-2xl font-semibold text-slate-900 sm:text-3xl">
              Statistics
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Maintenance and Other Operating Expenses — budget utilization overview
            </p>
          </div>

          {/* Period selector */}
          <div className="relative self-start">
            <button
              type="button"
              onClick={() => setPeriodOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {period}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {periodOpen && (
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriod(p);
                      setPeriodOpen(false);
                    }}
                    className={`block w-full px-3.5 py-2 text-left text-sm hover:bg-slate-50 ${
                      p === period ? "font-semibold text-teal-700" : "text-slate-600"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total MOOE Budget"
            value={peso(totals.budget)}
            sub="Allocated for the period"
            icon={<Wallet className="h-4 w-4" />}
          />
          <KpiCard
            label="Total Disbursed"
            value={peso(totals.disbursed)}
            sub="Recorded expenses to date"
            icon={<ReceiptText className="h-4 w-4" />}
          />
          <KpiCard
            label="Remaining Balance"
            value={peso(totals.remaining)}
            sub="Unspent as of latest entry"
            icon={<PiggyBank className="h-4 w-4" />}
          />
          <KpiCard
            label="Utilization Rate"
            value={pct(totals.utilization)}
            sub={getStatus(totals.utilization)}
            icon={<Gauge className="h-4 w-4" />}
          />
        </div>

        {/* Charts row */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Monthly trend */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Budget vs. Disbursement, by Month
              </h2>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300" /> Budget
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-700" /> Disbursed
                </span>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MONTHLY_DATA} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => peso(value as number)}
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "#e2e8f0",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="budget" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="disbursed" fill="#0f766e" radius={[3, 3, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category donut */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              Expenses by Category
            </h2>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={CATEGORY_DATA}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {CATEGORY_DATA.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => peso(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1.5">
              {CATEGORY_DATA.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    {c.name}
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {pct((c.amount / categoryTotal) * 100)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Ledger + Office table row */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Ledger-style breakdown */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">
              Category Ledger
            </h2>
            <p className="mb-2 text-xs text-slate-500">
              Share of total recorded expenses this period
            </p>
            <div className="divide-y divide-slate-100">
              {CATEGORY_DATA.map((c) => (
                <LedgerRow
                  key={c.name}
                  name={c.name}
                  amount={c.amount}
                  total={categoryTotal}
                />
              ))}
            </div>
          </div>

          {/* Office utilization table */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">
                Utilization by Office / Division
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4 font-semibold">Office</th>
                    <th className="pb-2 pr-4 font-semibold">Allocated</th>
                    <th className="pb-2 pr-4 font-semibold">Disbursed</th>
                    <th className="pb-2 pr-4 font-semibold">Utilization</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {OFFICE_ROWS.map((row) => {
                    const util = (row.disbursed / row.allocated) * 100;
                    const status = getStatus(util);
                    return (
                      <tr key={row.office}>
                        <td className="py-2.5 pr-4 text-slate-700">{row.office}</td>
                        <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-600">
                          {peso(row.allocated)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-900">
                          {peso(row.disbursed)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${
                                  status === "Over Budget"
                                    ? "bg-rose-500"
                                    : status === "Near Limit"
                                    ? "bg-amber-500"
                                    : "bg-teal-700"
                                }`}
                                style={{ width: `${Math.min(util, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs tabular-nums text-slate-500">
                              {pct(util)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Figures shown are illustrative — connect to your MOOE data source to populate live values.
        </p>
      </div>
    </div>
  );
};

export default MOOEStatistics;