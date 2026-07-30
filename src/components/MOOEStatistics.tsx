import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ---------- Types ----------

interface BudgetEntryRaw {
  id: string;
  fromMonth: string;
  toMonth: string;
  year: number;
  budget: number;
}

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

// A period option in the dropdown
interface PeriodOption {
  label: string;
  year: number;
  budgetEntryId: string | null; // null = "Full Year"
}

// ---------- Constants ----------

const MONTH_ORDER = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR: Record<string, string> = {
  January: "Jan", February: "Feb", March: "Mar", April: "Apr",
  May: "May", June: "Jun", July: "Jul", August: "Aug",
  September: "Sep", October: "Oct", November: "Nov", December: "Dec",
};

const CHART_COLORS = ["#0f766e", "#0891b2", "#b45309", "#78716c", "#4d7c0f", "#334155"];

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

function monthRangeLabel(fromMonth: string, toMonth: string): string {
  if (fromMonth === toMonth) return fromMonth;
  return `${fromMonth} – ${toMonth}`;
}

// ---------- Sub-components ----------

const KpiCard: React.FC<{
  label: string; value: string; sub: string; icon: React.ReactNode;
}> = ({ label, value, sub, icon }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="rounded-md bg-slate-50 p-2 text-slate-500 ring-1 ring-slate-200">{icon}</div>
    </div>
    <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    <p className="mt-1 text-xs text-slate-500">{sub}</p>
  </div>
);

const LedgerRow: React.FC<{ name: string; amount: number; total: number }> = ({ name, amount, total }) => {
  const share = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="whitespace-nowrap text-sm text-slate-700">{name}</span>
        <span className="flex-1 border-b border-dotted border-slate-300 translate-y-[-3px]" />
        <span className="whitespace-nowrap font-mono text-sm tabular-nums text-slate-900">{peso(amount)}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-teal-700" style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
    </div>
  );
};

// ---------- Main component ----------

interface MOOEStatisticsProps {
  onSecretTap?: () => void;
}

const MOOEStatistics: React.FC<MOOEStatisticsProps> = ({ onSecretTap }) => {
  const [allEntries, setAllEntries] = useState<BudgetEntryRaw[]>([]);
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [expenses, setExpenses] = useState<
    { categoryName: string | null; amount: number; expenseDate: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  // Triple-tap secret redirect
  const tapCountRef = React.useRef(0);
  const tapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 3) { tapCountRef.current = 0; onSecretTap?.(); return; }
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 600);
  };

  // ---- Load all budget entries on mount ----
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("budget_entries")
        .select("id, from_month, to_month, year, budget")
        .order("year", { ascending: false })
        .order("from_month", { ascending: true });

      if (!data || data.length === 0) return;

      const entries: BudgetEntryRaw[] = data.map((r) => ({
        id: r.id,
        fromMonth: r.from_month,
        toMonth: r.to_month,
        year: r.year,
        budget: Number(r.budget),
      }));
      setAllEntries(entries);

      // Build period options:
      // For each year: individual month entries + one "Full Year" option
      const yearsSeen = new Set<number>();
      const options: PeriodOption[] = [];

      for (const entry of entries) {
        // Individual entry option
        options.push({
          label: `${monthRangeLabel(entry.fromMonth, entry.toMonth)} ${entry.year}`,
          year: entry.year,
          budgetEntryId: entry.id,
        });
        yearsSeen.add(entry.year);
      }

      // Full Year options (one per year, inserted after each year's entries)
      const fullYearOptions: PeriodOption[] = [...yearsSeen].map((y) => ({
        label: `Full Year ${y}`,
        year: y,
        budgetEntryId: null,
      }));

      // Interleave: group by year, full year at end of each group
      const grouped: PeriodOption[] = [];
      for (const year of [...yearsSeen].sort((a, b) => b - a)) {
        grouped.push(...options.filter((o) => o.year === year && o.budgetEntryId !== null));
        grouped.push(fullYearOptions.find((o) => o.year === year)!);
      }

      setPeriodOptions(grouped);
      // Default: Full Year of the most recent year
      setSelectedPeriod(fullYearOptions[0]);
    };
    load();
  }, []);

  // ---- Load expenses when period changes ----
  useEffect(() => {
    if (!selectedPeriod) return;

    const load = async () => {
      setLoading(true);

      let query = supabase
        .from("expenses")
        .select(`amount, expense_date, expense_categories ( name ), budget_entries!inner ( year, id )`);

      if (selectedPeriod.budgetEntryId) {
        // Single budget entry
        query = query.eq("budget_entry_id", selectedPeriod.budgetEntryId);
      } else {
        // Full year — all entries for that year
        query = query.eq("budget_entries.year", selectedPeriod.year);
      }

      const { data } = await query;

      if (data) {
        setExpenses(
          data.map((r) => ({
            amount: Number(r.amount),
            expenseDate: r.expense_date,
            categoryName: (r.expense_categories as { name: string } | null)?.name ?? null,
          }))
        );
      }

      setLoading(false);
    };
    load();
  }, [selectedPeriod]);

  // ---- Budget entries in scope ----
  const activeBudgetEntries = useMemo(() => {
    if (!selectedPeriod) return [];
    if (selectedPeriod.budgetEntryId) {
      return allEntries.filter((e) => e.id === selectedPeriod.budgetEntryId);
    }
    return allEntries.filter((e) => e.year === selectedPeriod.year);
  }, [selectedPeriod, allEntries]);

  // ---- Monthly chart data ----
  const monthlyData = useMemo((): MonthlyPoint[] => {
    if (activeBudgetEntries.length === 0) return [];

    const budgetByMonth: Record<string, number> = {};
    for (const entry of activeBudgetEntries) {
      const fromIdx = MONTH_ORDER.indexOf(entry.fromMonth);
      const toIdx = MONTH_ORDER.indexOf(entry.toMonth);
      if (fromIdx === -1 || toIdx === -1) continue;
      const monthCount = toIdx - fromIdx + 1;
      const perMonth = monthCount > 0 ? entry.budget / monthCount : entry.budget;
      for (let i = fromIdx; i <= toIdx; i++) {
        budgetByMonth[MONTH_ORDER[i]] = (budgetByMonth[MONTH_ORDER[i]] ?? 0) + perMonth;
      }
    }

    const disbursedByMonth: Record<string, number> = {};
    for (const exp of expenses) {
      const date = new Date(exp.expenseDate);
      const monthName = MONTH_ORDER[date.getMonth()];
      disbursedByMonth[monthName] = (disbursedByMonth[monthName] ?? 0) + exp.amount;
    }

    return MONTH_ORDER.filter((m) => budgetByMonth[m] !== undefined).map((m) => ({
      month: MONTH_ABBR[m] ?? m,
      budget: Math.round(budgetByMonth[m] ?? 0),
      disbursed: Math.round(disbursedByMonth[m] ?? 0),
    }));
  }, [activeBudgetEntries, expenses]);

  // ---- KPI totals ----
  const totals = useMemo(() => {
    const budget = activeBudgetEntries.reduce((s, b) => s + b.budget, 0);
    const disbursed = expenses.reduce((s, e) => s + e.amount, 0);
    const remaining = budget - disbursed;
    const utilization = budget > 0 ? (disbursed / budget) * 100 : 0;
    return { budget, disbursed, remaining, utilization };
  }, [activeBudgetEntries, expenses]);

  // ---- Category breakdown ----
  const categoryData = useMemo((): CategoryBreakdown[] => {
    const map: Record<string, number> = {};
    for (const exp of expenses) {
      const key = exp.categoryName ?? "Uncategorized";
      map[key] = (map[key] ?? 0) + exp.amount;
    }
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const categoryTotal = useMemo(() => categoryData.reduce((s, c) => s + c.amount, 0), [categoryData]);
  const budgetStatus = getStatus(totals.utilization);
  const hasData = activeBudgetEntries.length > 0;

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
          {periodOptions.length > 0 && (
            <div className="relative self-start">
              <button
                type="button"
                onClick={() => setPeriodOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {selectedPeriod?.label ?? "Select period"}
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              {periodOpen && (
                <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  {periodOptions.map((opt) => (
                    <button
                      key={opt.budgetEntryId ?? `full-${opt.year}`}
                      onClick={() => { setSelectedPeriod(opt); setPeriodOpen(false); }}
                      className={`block w-full px-3.5 py-2 text-left text-sm hover:bg-slate-50
                        ${opt.budgetEntryId === null ? "font-semibold text-teal-700 border-t border-slate-100 mt-0.5" : "text-slate-600"}
                        ${selectedPeriod?.label === opt.label ? "bg-teal-50" : ""}
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Loading statistics…
          </div>
        )}

        {/* No budgets at all */}
        {!loading && periodOptions.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-20 text-center">
            <p className="text-sm text-slate-500">
              No budget entries found. Add budgets in the Budget tab to see statistics here.
            </p>
          </div>
        )}

        {/* Content */}
        {!loading && hasData && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Total MOOE Budget"
                value={peso(totals.budget)}
                sub={selectedPeriod?.label ?? ""}
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
                sub={budgetStatus}
                icon={<Gauge className="h-4 w-4" />}
              />
            </div>

            {/* Charts row */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Monthly bar chart */}
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
                {monthlyData.length === 0 ? (
                  <div className="flex h-72 items-center justify-center text-sm text-slate-400">
                    No monthly data for this period.
                  </div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} barGap={4}>
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
                          contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
                        />
                        <Bar dataKey="budget" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={22} />
                        <Bar dataKey="disbursed" fill="#0f766e" radius={[3, 3, 0, 0]} maxBarSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Category donut */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">Expenses by Category</h2>
                {categoryData.length === 0 ? (
                  <div className="flex h-44 items-center justify-center text-sm text-slate-400">
                    No expenses recorded.
                  </div>
                ) : (
                  <>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            dataKey="amount"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={68}
                            paddingAngle={2}
                          >
                            {categoryData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => peso(value as number)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {categoryData.map((c, i) => (
                        <li key={c.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
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
                  </>
                )}
              </div>
            </div>

            {/* Category ledger */}
            {categoryData.length > 0 && (
              <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Category Ledger</h2>
                <p className="mb-3 text-xs text-slate-500">
                  Share of total recorded expenses — {selectedPeriod?.label}
                </p>
                <div className="divide-y divide-slate-100">
                  {categoryData.map((c) => (
                    <LedgerRow key={c.name} name={c.name} amount={c.amount} total={categoryTotal} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MOOEStatistics;
