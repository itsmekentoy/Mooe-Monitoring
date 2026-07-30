import React, { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Save,
} from "lucide-react";

/**
 * MOOE Expenses Monitoring System — Budget & Expense Entry
 * ---------------------------------------------------------
 * Step 1: Set the month's liquidated budget amount and save it.
 * Step 2: Once the budget is saved, a dynamic expense table appears
 *         where rows (date + amount) can be added, edited, and removed,
 *         then saved as a batch.
 *
 * Stack: React + TypeScript + Tailwind CSS + lucide-react
 */

// ---------- Types ----------

interface Budget {
  month: string;
  budgetAmount: number;
  amountLiquidated: number;
}

interface ExpenseRow {
  id: string;
  date: string;
  amount: string; // kept as string while editing, parsed on save
}

// ---------- Constants ----------

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const peso = (value: number): string =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const newRowId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ---------- Component ----------

const MOOEBudgetEntry: React.FC = () => {
  // Budget form state
  const [monthInput, setMonthInput] = useState<string>(MONTHS[0]);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [budget, setBudget] = useState<Budget | null>(null);
  const [budgetError, setBudgetError] = useState<string>("");

  // Expense table state
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expensesSavedAt, setExpensesSavedAt] = useState<Date | null>(null);
  const [expenseError, setExpenseError] = useState<string>("");

  const isEditingBudget = budget === null;

  // ---- Budget handlers ----

  const handleSaveBudget = () => {
    const parsedBudget = parseFloat(budgetInput);
    if (!budgetInput || isNaN(parsedBudget) || parsedBudget <= 0) {
      setBudgetError("Enter a valid budget amount greater than 0.");
      return;
    }
    const parsedLiquidated = parseFloat(amountInput);
    if (!amountInput || isNaN(parsedLiquidated) || parsedLiquidated <= 0) {
      setBudgetError("Enter a valid liquidated amount greater than 0.");
      return;
    }
    setBudget({
      month: monthInput,
      budgetAmount: parsedBudget,
      amountLiquidated: parsedLiquidated,
    });
    setBudgetError("");
  };

  const handleEditBudget = () => {
    if (budget) {
      setMonthInput(budget.month);
      setBudgetInput(String(budget.budgetAmount));
      setAmountInput(String(budget.amountLiquidated));
    }
    setBudget(null);
    setExpensesSavedAt(null);
  };

  // ---- Expense handlers ----

  const addExpenseRow = () => {
    setExpenses((rows) => [...rows, { id: newRowId(), date: "", amount: "" }]);
    setExpensesSavedAt(null);
  };

  const updateExpenseRow = (id: string, field: "date" | "amount", value: string) => {
    setExpenses((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    setExpensesSavedAt(null);
  };

  const removeExpenseRow = (id: string) => {
    setExpenses((rows) => rows.filter((row) => row.id !== id));
    setExpensesSavedAt(null);
  };

  const handleSaveExpenses = () => {
    if (expenses.length === 0) {
      setExpenseError("Add at least one expense entry before saving.");
      return;
    }
    const hasInvalidRow = expenses.some((row) => {
      const amt = parseFloat(row.amount);
      return !row.date || !row.amount || isNaN(amt) || amt <= 0;
    });
    if (hasInvalidRow) {
      setExpenseError("Every row needs a valid date and an amount greater than 0.");
      return;
    }
    setExpenseError("");
    // Replace this with your API call, e.g. POST /api/expenses
    setExpensesSavedAt(new Date());
  };

  // ---- Derived totals ----

  const totalExpenses = useMemo(
    () =>
      expenses.reduce((sum, row) => {
        const amt = parseFloat(row.amount);
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0),
    [expenses]
  );

  const remaining = budget ? budget.amountLiquidated - totalExpenses : 0;
  const isOverBudget = budget !== null && remaining < 0;

  return (
    <div className="min-h-full w-full bg-slate-50 p-6 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
            MOOE Expenses Monitoring System
          </p>
          <h1 className="mt-1 font-mono text-2xl font-semibold text-slate-900 sm:text-3xl">
            Budget &amp; Expense Entry
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Save the month&apos;s liquidated budget first, then log expenses against it.
          </p>
        </div>

        {/* Step 1: Budget card */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              1. Monthly Budget
            </h2>
            {!isEditingBudget && (
              <button
                type="button"
                onClick={handleEditBudget}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>

          {isEditingBudget ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
              <div className="sm:col-span-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Month
                </label>
                <select
                  value={monthInput}
                  onChange={(e) => setMonthInput(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Amount Liquidated
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                    ₱
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleSaveBudget}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                >
                  <Save className="h-4 w-4" />
                  Save Budget
                </button>
              </div>

              {budgetError && (
                <p className="sm:col-span-3 flex items-center gap-1.5 text-xs text-rose-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {budgetError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
              <div>
                <p className="text-xs text-slate-500">Month</p>
                <p className="text-sm font-medium text-slate-900">{budget?.month}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Amount Liquidated</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {budget ? peso(budget.amountLiquidated) : ""}
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            </div>
          )}
        </div>

        {/* Step 2: Expense table — only after budget is saved */}
        {!isEditingBudget && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">2. Expenses</h2>
              <button
                type="button"
                onClick={addExpenseRow}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Expense
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 py-10 text-center">
                <p className="text-sm text-slate-500">
                  No expenses yet. Click &quot;Add Expense&quot; to log one.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="w-1/2 pb-2 pr-4 font-semibold">Date</th>
                      <th className="w-1/2 pb-2 pr-4 font-semibold">Amount</th>
                      <th className="w-10 pb-2 font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-4">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) =>
                              updateExpenseRow(row.id, "date", e.target.value)
                            }
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">
                              ₱
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.amount}
                              onChange={(e) =>
                                updateExpenseRow(row.id, "amount", e.target.value)
                              }
                              placeholder="0.00"
                              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-6 pr-3 text-sm tabular-nums text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                            />
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeExpenseRow(row.id)}
                            aria-label="Remove expense"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expenseError && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {expenseError}
              </p>
            )}

            {/* Totals + save */}
            <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Total Expenses</p>
                  <p className="font-mono font-semibold tabular-nums text-slate-900">
                    {peso(totalExpenses)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Remaining Balance</p>
                  <p
                    className={`font-mono font-semibold tabular-nums ${
                      isOverBudget ? "text-rose-600" : "text-teal-700"
                    }`}
                  >
                    {peso(remaining)}
                  </p>
                </div>
                {isOverBudget && (
                  <span className="flex items-center gap-1.5 self-center text-xs font-medium text-rose-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Over budget
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {expensesSavedAt && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Saved at {expensesSavedAt.toLocaleTimeString()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveExpenses}
                  className="flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                >
                  <Save className="h-4 w-4" />
                  Save Expenses
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MOOEBudgetEntry;