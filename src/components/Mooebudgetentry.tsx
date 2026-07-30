import React, { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Save,
  Wallet,
  ReceiptText,
  Settings,
  Tag,
  Users,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
} from "lucide-react";

/**
 * MOOE Expenses Monitoring System — Budget & Expense Entry
 * ---------------------------------------------------------
 * Budget tab: form to add budget entries + list table of all saved budgets.
 * Expenses tab: dynamic expense rows against the saved budget.
 * Settings > Categories / User Management: placeholder panels.
 */

// ---------- Types ----------

type NavItem = "budget" | "expenses" | "categories" | "user-management";

interface BudgetEntry {
  id: string;
  fromMonth: string;
  toMonth: string;
  year: number;
  budget: number;
  createdByName: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
}

interface UserAccount {
  id: string;
  name: string;
  email: string;
  password: string;
}

interface ExpenseRow {
  id: string;
  date: string;
  amount: string;
  categoryId: string;
  liquidated: boolean;
  liquidatedAmount: string;
  createdByName: string;
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

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ---------- Placeholder panels ----------

import { type AuthUser } from "../lib/auth";
import { supabase } from "../lib/supabase";

// ---------- Main component ----------

interface MOOEBudgetEntryProps {
  user: AuthUser;
  onLogout: () => void;
}

const MOOEBudgetEntry: React.FC<MOOEBudgetEntryProps> = ({ user, onLogout }) => {
  // Navigation
  const NAV_KEY = "mooe_active_nav";

  const [activeNav, setActiveNav] = useState<NavItem>(() => {
    const saved = sessionStorage.getItem(NAV_KEY) as NavItem | null;
    return saved ?? "budget";
  });
  const [settingsOpen, setSettingsOpen] = useState(() => {
    const saved = sessionStorage.getItem("mooe_active_nav") as NavItem | null;
    return saved === "categories" || saved === "user-management";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Budget form state
  const [monthInput, setMonthInput] = useState<string>(MONTHS[0]);
  const [toMonthInput, setToMonthInput] = useState<string>(MONTHS[11]);
  const [yearInput, setYearInput] = useState<string>(String(new Date().getFullYear()));
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [budgetError, setBudgetError] = useState<string>("");

  // Budget list
  const [budgetList, setBudgetList] = useState<BudgetEntry[]>([]);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  // Expense — month-year selection
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [confirmedBudgetId, setConfirmedBudgetId] = useState<string | null>(null);

  const selectedBudget = budgetList.find((b) => b.id === confirmedBudgetId) ?? null;

  // Compute allowed date range for expense date inputs
  const expenseDateMin = useMemo(() => {
    if (!selectedBudget) return undefined;
    const monthIdx = MONTHS.indexOf(selectedBudget.fromMonth);
    if (monthIdx === -1) return undefined;
    const mm = String(monthIdx + 1).padStart(2, "0");
    return `${selectedBudget.year}-${mm}-01`;
  }, [selectedBudget]);

  const expenseDateMax = useMemo(() => {
    if (!selectedBudget) return undefined;
    const monthIdx = MONTHS.indexOf(selectedBudget.toMonth);
    if (monthIdx === -1) return undefined;
    // Last day of the toMonth
    const lastDay = new Date(selectedBudget.year, monthIdx + 1, 0).getDate();
    const mm = String(monthIdx + 1).padStart(2, "0");
    const dd = String(lastDay).padStart(2, "0");
    return `${selectedBudget.year}-${mm}-${dd}`;
  }, [selectedBudget]);

  const handleSelectBudget = async () => {
    if (!selectedBudgetId) return;
    setConfirmedBudgetId(selectedBudgetId);
    await fetchExpenses(selectedBudgetId);
  };

  const handleClearBudgetSelection = () => {
    setConfirmedBudgetId(null);
    setSelectedBudgetId("");
    setExpenses([]);
    setExpensesSavedAt(null);
    setExpenseError("");
  };

  // Expense table state
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesSaving, setExpensesSaving] = useState(false);
  const [expensesSavedAt, setExpensesSavedAt] = useState<Date | null>(null);
  const [expenseError, setExpenseError] = useState<string>("");

  // ---- Expense handlers ----

  const fetchExpenses = async (budgetId: string) => {
    setExpensesLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("id, expense_date, amount, category_id, liquidated, liquidated_amount, created_by:users!expenses_created_by_fkey(name)")
      .eq("budget_entry_id", budgetId)
      .order("expense_date", { ascending: true });

    if (!error && data) {
      setExpenses(
        data.map((r) => ({
          id: r.id,
          date: r.expense_date,
          amount: String(r.amount),
          categoryId: r.category_id ?? "",
          liquidated: r.liquidated,
          liquidatedAmount: r.liquidated_amount != null ? String(r.liquidated_amount) : "",
          createdByName: (r.created_by as unknown as { name: string } | null)?.name ?? "—",
        }))
      );
    }
    setExpensesLoading(false);
  };

  const addExpenseRow = () => {
    // Rows added locally; saved to DB on "Save Expenses"
    setExpenses((rows) => [
      ...rows,
      { id: `new-${newId()}`, date: "", amount: "", categoryId: "", liquidated: false, liquidatedAmount: "", createdByName: user.name },
    ]);
    setExpensesSavedAt(null);
  };

  const updateExpenseRow = (
    id: string,
    field: "date" | "amount" | "categoryId" | "liquidatedAmount",
    value: string
  ) => {
    setExpenses((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    setExpensesSavedAt(null);
  };

  const toggleLiquidated = (id: string) => {
    setExpenses((rows) =>
      rows.map((row) =>
        row.id === id
          ? { ...row, liquidated: !row.liquidated, liquidatedAmount: !row.liquidated ? "" : row.liquidatedAmount }
          : row
      )
    );
    setExpensesSavedAt(null);
  };

  const removeExpenseRow = async (id: string) => {
    // If it's a persisted row (real UUID), delete from DB
    if (!id.startsWith("new-")) {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) { setExpenseError("Failed to delete row: " + error.message); return; }
    }
    setExpenses((rows) => rows.filter((row) => row.id !== id));
    setExpensesSavedAt(null);
  };

  const handleSaveExpenses = async () => {
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

    setExpensesSaving(true);
    setExpenseError("");

    try {
      for (const row of expenses) {
        const payload = {
          budget_entry_id: confirmedBudgetId!,
          expense_date: row.date,
          amount: parseFloat(row.amount),
          category_id: row.categoryId || null,
          liquidated: row.liquidated,
          liquidated_amount: row.liquidated && row.liquidatedAmount
            ? parseFloat(row.liquidatedAmount)
            : null,
          created_by: user.id,
        };

        if (row.id.startsWith("new-")) {
          // Insert new row
          const { data, error } = await supabase
            .from("expenses")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          // Replace temp id with real DB id
          setExpenses((prev) =>
            prev.map((r) => r.id === row.id ? { ...r, id: data.id } : r)
          );
        } else {
          // Update existing row
          const { error } = await supabase
            .from("expenses")
            .update(payload)
            .eq("id", row.id);
          if (error) throw new Error(error.message);
        }
      }

      setExpensesSavedAt(new Date());
    } catch (err) {
      setExpenseError(err instanceof Error ? err.message : "Failed to save expenses.");
    } finally {
      setExpensesSaving(false);
    }
  };


  const [budgetListLoading, setBudgetListLoading] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);

  const fetchBudgets = async () => {
    setBudgetListLoading(true);
    const { data, error } = await supabase
      .from("budget_entries")
      .select("id, from_month, to_month, year, budget, created_by:users!budget_entries_created_by_fkey(name)")
      .order("year", { ascending: true })
      .order("from_month", { ascending: true });
    if (!error && data) {
      setBudgetList(
        data.map((r) => ({
          id: r.id,
          fromMonth: r.from_month,
          toMonth: r.to_month,
          year: r.year,
          budget: r.budget,
          createdByName: (r.created_by as unknown as { name: string } | null)?.name ?? "—",
        }))
      );
    }
    setBudgetListLoading(false);
  };

  React.useEffect(() => {
    if (activeNav === "budget") fetchBudgets();
    // Also load budgets when switching to expenses tab so the dropdown is populated
    if (activeNav === "expenses") fetchBudgets();
  }, [activeNav]);

  const handleSaveBudget = async () => {
    const parsed = parseFloat(budgetInput);
    if (!budgetInput || isNaN(parsed) || parsed <= 0) {
      setBudgetError("Enter a valid budget amount greater than 0.");
      return;
    }
    const parsedYear = parseInt(yearInput, 10);
    if (!yearInput || isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      setBudgetError("Enter a valid year (2000 – 2100).");
      return;
    }

    setBudgetSaving(true);
    setBudgetError("");

    try {
      if (editingBudgetId) {
        const { error } = await supabase
          .from("budget_entries")
          .update({
            from_month: monthInput,
            to_month: toMonthInput,
            year: parsedYear,
            budget: parsed,
          })
          .eq("id", editingBudgetId);
        if (error) throw new Error(error.message);
        setEditingBudgetId(null);
      } else {
        const { error } = await supabase.from("budget_entries").insert({
          from_month: monthInput,
          to_month: toMonthInput,
          year: parsedYear,
          budget: parsed,
          created_by: user.id,
        });
        if (error) throw new Error(error.message);
      }

      setMonthInput(MONTHS[0]);
      setToMonthInput(MONTHS[11]);
      setYearInput(String(new Date().getFullYear()));
      setBudgetInput("");
      await fetchBudgets();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : "Failed to save budget.");
    } finally {
      setBudgetSaving(false);
    }
  };

  const handleEditBudgetRow = (entry: BudgetEntry) => {
    setMonthInput(entry.fromMonth);
    setToMonthInput(entry.toMonth);
    setYearInput(String(entry.year));
    setBudgetInput(String(entry.budget));
    setEditingBudgetId(entry.id);
    setBudgetError("");
  };

  const handleDeleteBudgetRow = async (id: string) => {
    const { error } = await supabase.from("budget_entries").delete().eq("id", id);
    if (error) { setBudgetError("Failed to delete: " + error.message); return; }
    if (editingBudgetId === id) {
      setEditingBudgetId(null);
      setMonthInput(MONTHS[0]);
      setToMonthInput(MONTHS[11]);
      setBudgetInput("");
    }
    await fetchBudgets();
  };

  const handleCancelEdit = () => {
    setEditingBudgetId(null);
    setMonthInput(MONTHS[0]);
    setToMonthInput(MONTHS[11]);
    setYearInput(String(new Date().getFullYear()));
    setBudgetInput("");
    setBudgetError("");
  };

  // Categories
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [catListLoading, setCatListLoading] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [catNameInput, setCatNameInput] = useState("");
  const [catDescInput, setCatDescInput] = useState("");
  const [catError, setCatError] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  const fetchCategories = async () => {
    setCatListLoading(true);
    const { data, error } = await supabase
      .from("expense_categories")
      .select("id, name, description")
      .order("name", { ascending: true });
    if (!error && data) setCategoryList(data as Category[]);
    setCatListLoading(false);
  };

  React.useEffect(() => {
    if (activeNav === "categories") fetchCategories();
    // Also fetch categories when expenses tab is active (needed for dropdown)
    if (activeNav === "expenses") fetchCategories();
  }, [activeNav]);

  const handleSaveCategory = async () => {
    if (!catNameInput.trim()) {
      setCatError("Category name is required.");
      return;
    }

    setCatSaving(true);
    setCatError("");

    try {
      if (editingCatId) {
        const { error } = await supabase
          .from("expense_categories")
          .update({ name: catNameInput.trim(), description: catDescInput.trim() })
          .eq("id", editingCatId);
        if (error) {
          if (error.code === "23505") throw new Error("A category with this name already exists.");
          throw new Error(error.message);
        }
        setEditingCatId(null);
      } else {
        const { error } = await supabase
          .from("expense_categories")
          .insert({ name: catNameInput.trim(), description: catDescInput.trim() });
        if (error) {
          if (error.code === "23505") throw new Error("A category with this name already exists.");
          throw new Error(error.message);
        }
      }

      setCatNameInput("");
      setCatDescInput("");
      await fetchCategories();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Failed to save category.");
    } finally {
      setCatSaving(false);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setCatNameInput(cat.name);
    setCatDescInput(cat.description);
    setEditingCatId(cat.id);
    setCatError("");
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from("expense_categories").delete().eq("id", id);
    if (error) { setCatError("Failed to delete: " + error.message); return; }
    // Clear from any expense rows using it
    setExpenses((prev) => prev.map((r) => r.categoryId === id ? { ...r, categoryId: "" } : r));
    if (editingCatId === id) {
      setEditingCatId(null);
      setCatNameInput("");
      setCatDescInput("");
    }
    await fetchCategories();
  };

  const handleCancelCatEdit = () => {
    setEditingCatId(null);
    setCatNameInput("");
    setCatDescInput("");
    setCatError("");
  };

  // ---- User Management state & handlers ----

  const [userList, setUserList] = useState<UserAccount[]>([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [userNameInput, setUserNameInput] = useState("");
  const [userEmailInput, setUserEmailInput] = useState("");
  const [userPasswordInput, setUserPasswordInput] = useState("");
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [userError, setUserError] = useState("");
  const [userSaving, setUserSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Fetch all users from Supabase
  const fetchUsers = async () => {
    setUserListLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, password")
      .order("created_at", { ascending: true });
    if (!error && data) setUserList(data as UserAccount[]);
    setUserListLoading(false);
  };

  // Load users when the user-management tab becomes active
  React.useEffect(() => {
    if (activeNav === "user-management") fetchUsers();
  }, [activeNav]);

  const handleSaveUser = async () => {
    if (!userNameInput.trim()) { setUserError("Name is required."); return; }
    if (!userEmailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmailInput)) {
      setUserError("Enter a valid email address."); return;
    }
    if (!editingUserId && !userPasswordInput) { setUserError("Password is required."); return; }
    if (userPasswordInput && userPasswordInput.length < 6) {
      setUserError("Password must be at least 6 characters."); return;
    }

    setUserSaving(true);
    setUserError("");

    try {
      if (editingUserId) {
        // Build update payload — only hash & update password if a new one was typed
        const updates: Record<string, string> = {
          name: userNameInput.trim(),
          email: userEmailInput.trim().toLowerCase(),
        };
        if (userPasswordInput) {
          const bcrypt = await import("bcryptjs");
          updates.password = await bcrypt.hash(userPasswordInput, 12);
        }

        const { error } = await supabase
          .from("users")
          .update(updates)
          .eq("id", editingUserId);

        if (error) throw new Error(error.message);
        setEditingUserId(null);
      } else {
        // Hash password before inserting
        const bcrypt = await import("bcryptjs");
        const hashed = await bcrypt.hash(userPasswordInput, 12);

        const { error } = await supabase.from("users").insert({
          name: userNameInput.trim(),
          email: userEmailInput.trim().toLowerCase(),
          password: hashed,
        });

        if (error) {
          if (error.message.includes("unique") || error.code === "23505") {
            throw new Error("A user with this email already exists.");
          }
          throw new Error(error.message);
        }
      }

      setUserNameInput("");
      setUserEmailInput("");
      setUserPasswordInput("");
      setShowUserPassword(false);
      await fetchUsers();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Failed to save user.");
    } finally {
      setUserSaving(false);
    }
  };

  const handleEditUser = (u: UserAccount) => {
    setUserNameInput(u.name);
    setUserEmailInput(u.email);
    setUserPasswordInput("");
    setEditingUserId(u.id);
    setUserError("");
    setShowUserPassword(false);
  };

  const handleDeleteUser = async (id: string) => {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) { setUserError("Failed to delete user: " + error.message); return; }
    if (editingUserId === id) {
      setEditingUserId(null);
      setUserNameInput("");
      setUserEmailInput("");
      setUserPasswordInput("");
      setUserError("");
    }
    await fetchUsers();
  };

  const handleCancelUserEdit = () => {
    setEditingUserId(null);
    setUserNameInput("");
    setUserEmailInput("");
    setUserPasswordInput("");
    setUserError("");
    setShowUserPassword(false);
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

  const remaining = selectedBudget ? selectedBudget.budget - totalExpenses : 0;
  const isOverBudget = selectedBudget !== null && remaining < 0;

  // ---- Nav helper ----

  const navigate = (item: NavItem) => {
    setActiveNav(item);
    sessionStorage.setItem(NAV_KEY, item);
    setSidebarOpen(false);
    if (item === "categories" || item === "user-management") {
      setSettingsOpen(true);
    }
  };

  const navLink = (
    item: NavItem,
    label: string,
    icon: React.ReactNode,
    indent = false
  ) => (
    <button
      type="button"
      onClick={() => navigate(item)}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
        ${indent ? "pl-9" : ""}
        ${activeNav === item
          ? "bg-teal-700 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
    >
      {icon}
      {label}
    </button>
  );

  // ---------- Sidebar ----------

  const Sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-4 px-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
          MOOE System
        </p>
      </div>
      {navLink("budget", "Budget", <Wallet className="h-4 w-4 shrink-0" />)}
      {navLink("expenses", "Expenses", <ReceiptText className="h-4 w-4 shrink-0" />)}
      <div>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Settings</span>
          {settingsOpen
            ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
        </button>
        {settingsOpen && (
          <div className="mt-0.5 flex flex-col gap-0.5">
            {navLink("categories", "Categories", <Tag className="h-4 w-4 shrink-0" />, true)}
            {navLink("user-management", "User Management", <Users className="h-4 w-4 shrink-0" />, true)}
          </div>
        )}
      </div>
    </nav>
  );

  // ---------- Page title ----------

  const pageTitle: Record<NavItem, string> = {
    budget: "Budget",
    expenses: "Expenses",
    categories: "Categories",
    "user-management": "User Management",
  };

  // ---------- Budget panel ----------

  const renderBudgetPanel = () => (
    <>
      {/* Entry form */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">
          {editingBudgetId ? "Edit Budget Entry" : "Add Budget Entry"}
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6 sm:items-end">
          {/* From Month */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              From Month
            </label>
            <select
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* To Month */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              To Month
            </label>
            <select
              value={toMonthInput}
              onChange={(e) => setToMonthInput(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Year
            </label>
            <input
              type="number"
              min="2000"
              max="2100"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              placeholder={String(new Date().getFullYear())}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>

          {/* Budget amount */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Budget
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                ₱
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveBudget}
              disabled={budgetSaving}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {budgetSaving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editingBudgetId ? "Update" : "Save"}
                </>
              )}
            </button>
            {editingBudgetId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>

          {budgetError && (
            <p className="flex items-center gap-1.5 text-xs text-rose-600 sm:col-span-6">
              <AlertTriangle className="h-3.5 w-3.5" />
              {budgetError}
            </p>
          )}
        </div>
      </div>

      {/* Budget list table */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">List of Budgets</h2>

        {budgetListLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Loading budgets…
          </div>
        ) : budgetList.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 py-10 text-center">
            <p className="text-sm text-slate-500">
              No budget entries yet. Add one above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-semibold">#</th>
                  <th className="pb-2 pr-4 font-semibold">From</th>
                  <th className="pb-2 pr-4 font-semibold">To</th>
                  <th className="pb-2 pr-4 font-semibold">Year</th>
                  <th className="pb-2 pr-4 font-semibold">Budget</th>
                  <th className="pb-2 pr-4 font-semibold">Created By</th>
                  <th className="pb-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {budgetList.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className={editingBudgetId === entry.id ? "bg-teal-50" : ""}
                  >
                    <td className="py-2.5 pr-4 text-slate-400">{index + 1}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{entry.fromMonth}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{entry.toMonth}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{entry.year}</td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-900">
                      {peso(entry.budget)}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">{entry.createdByName}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editingBudgetId === entry.id ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-teal-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Editing
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEditBudgetRow(entry)}
                            aria-label="Edit budget entry"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteBudgetRow(entry.id)}
                          aria-label="Delete budget entry"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Total row */}
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td colSpan={5} className="pt-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </td>
                  <td className="pt-3 pr-4 font-mono font-semibold tabular-nums text-slate-900">
                    {peso(budgetList.reduce((sum, b) => sum + b.budget, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );

  // ---------- Expenses panel ----------

  const renderExpensesPanel = () => (
    <div className="space-y-6">
      {/* Month-Year selector card */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Select Budget Period</h2>

        {budgetList.length === 0 ? (
          <p className="text-sm text-slate-500">
            No budget entries found. Add a budget first.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Month – Year
              </label>
              <select
                value={selectedBudgetId}
                onChange={(e) => setSelectedBudgetId(e.target.value)}
                disabled={confirmedBudgetId !== null}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">— Select period —</option>
                {budgetList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fromMonth} – {b.toMonth} {b.year}
                  </option>
                ))}
              </select>
            </div>

            {/* Select / Selected button */}
            <button
              type="button"
              onClick={handleSelectBudget}
              disabled={confirmedBudgetId !== null || !selectedBudgetId}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors
                ${confirmedBudgetId !== null
                  ? "cursor-not-allowed bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/30"
                  : "bg-teal-700 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                }`}
            >
              {confirmedBudgetId !== null ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Selected
                </>
              ) : (
                "Select"
              )}
            </button>

            {/* Clear button — only visible once a period is selected */}
            {confirmedBudgetId !== null && (
              <button
                type="button"
                onClick={handleClearBudgetSelection}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        )}

        {/* Summary of selected budget */}
        {selectedBudget && (
          <div className="mt-4 flex flex-wrap gap-6 rounded-md border border-teal-100 bg-teal-50 px-4 py-3">
            <div>
              <p className="text-xs text-teal-600">Period</p>
              <p className="text-sm font-semibold text-teal-900">
                {selectedBudget.fromMonth} – {selectedBudget.toMonth} {selectedBudget.year}
              </p>
            </div>
            <div>
              <p className="text-xs text-teal-600">Budget</p>
              <p className="font-mono text-sm font-semibold tabular-nums text-teal-900">
                {peso(selectedBudget.budget)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Expense entry card — only shown after a period is confirmed */}
      {selectedBudget && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Expense Entry</h2>
            <button
              type="button"
              onClick={addExpenseRow}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Expense
            </button>
          </div>

          {expensesLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Loading expenses…
            </div>
          ) : expenses.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 py-10 text-center">
              <p className="text-sm text-slate-500">
                No expenses yet. Click "Add Expense" to log one.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4 font-semibold">Date</th>
                    <th className="pb-2 pr-4 font-semibold">Category</th>
                    <th className="pb-2 pr-4 font-semibold">Amount</th>
                    <th className="pb-2 pr-4 font-semibold">Liquidated</th>
                    <th className="pb-2 pr-4 font-semibold">Created By</th>
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
                          min={expenseDateMin}
                          max={expenseDateMax}
                          onChange={(e) => updateExpenseRow(row.id, "date", e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={row.categoryId}
                          onChange={(e) => updateExpenseRow(row.id, "categoryId", e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        >
                          <option value="">— Select —</option>
                          {categoryList.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
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
                            onChange={(e) => updateExpenseRow(row.id, "amount", e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-6 pr-3 text-sm tabular-nums text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`liq-${row.id}`}
                            checked={row.liquidated}
                            onChange={() => toggleLiquidated(row.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          {row.liquidated && (
                            <div className="relative">
                              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-slate-400">
                                ₱
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.liquidatedAmount}
                                onChange={(e) => updateExpenseRow(row.id, "liquidatedAmount", e.target.value)}
                                placeholder="0.00"
                                className="w-28 rounded-md border border-teal-300 bg-teal-50 py-1.5 pl-6 pr-2 text-sm tabular-nums text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                              />
                            </div>
                          )}
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
                <p className={`font-mono font-semibold tabular-nums ${isOverBudget ? "text-rose-600" : "text-teal-700"}`}>
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
                disabled={expensesSaving}
                className="flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {expensesSaving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Expenses
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ---------- Shell ----------

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-56 border-r border-slate-200 bg-white shadow-sm transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:shadow-none`}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-600 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
        {Sidebar}
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-4 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
              MOOE Expenses Monitoring System
            </p>
            <h1 className="font-mono text-xl font-semibold text-slate-900">
              {pageTitle[activeNav]}
            </h1>
          </div>
          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-rose-600"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 sm:p-8">
          <div className="w-full">
            {activeNav === "budget" && renderBudgetPanel()}
            {activeNav === "expenses" && renderExpensesPanel()}
            {activeNav === "categories" && (
              <div className="space-y-6">
                {/* Add / Edit form */}
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-slate-900">
                    {editingCatId ? "Edit Category" : "Add Expense Category"}
                  </h2>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
                    {/* Name */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Category Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={catNameInput}
                        onChange={(e) => { setCatNameInput(e.target.value); setCatError(""); }}
                        placeholder="e.g. Office Supplies"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Description <span className="text-slate-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={catDescInput}
                        onChange={(e) => setCatDescInput(e.target.value)}
                        placeholder="Short description"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveCategory}
                        disabled={catSaving}
                        className="flex flex-1 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {catSaving ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Saving…
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            {editingCatId ? "Update" : "Save"}
                          </>
                        )}
                      </button>
                      {editingCatId && (
                        <button
                          type="button"
                          onClick={handleCancelCatEdit}
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {catError && (
                      <p className="flex items-center gap-1.5 text-xs text-rose-600 sm:col-span-3">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {catError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Category list */}
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-slate-900">
                    Expense Categories
                    {categoryList.length > 0 && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {categoryList.length}
                      </span>
                    )}
                  </h2>

                  {catListLoading ? (
                    <div className="flex items-center justify-center py-10 text-slate-400">
                      <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Loading categories…
                    </div>
                  ) : categoryList.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 py-10 text-center">
                      <Tag className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                      <p className="text-sm text-slate-500">
                        No categories yet. Add one above.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[400px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                            <th className="pb-2 pr-4 font-semibold">#</th>
                            <th className="pb-2 pr-4 font-semibold">Name</th>
                            <th className="pb-2 pr-4 font-semibold">Description</th>
                            <th className="pb-2 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {categoryList.map((cat, index) => (
                            <tr
                              key={cat.id}
                              className={editingCatId === cat.id ? "bg-teal-50" : ""}
                            >
                              <td className="py-2.5 pr-4 text-slate-400">{index + 1}</td>
                              <td className="py-2.5 pr-4 font-medium text-slate-900">{cat.name}</td>
                              <td className="py-2.5 pr-4 text-slate-500">
                                {cat.description || <span className="italic text-slate-300">—</span>}
                              </td>
                              <td className="py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {editingCatId === cat.id ? (
                                    <span className="flex items-center gap-1 text-xs font-medium text-teal-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Editing
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleEditCategory(cat)}
                                      aria-label="Edit category"
                                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    aria-label="Delete category"
                                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeNav === "user-management" && (
              <div className="space-y-6">
                {/* Add / Edit form */}
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-slate-900">
                    {editingUserId ? "Edit User" : "Add User"}
                  </h2>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
                    {/* Name */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={userNameInput}
                        onChange={(e) => { setUserNameInput(e.target.value); setUserError(""); }}
                        placeholder="Full name"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={userEmailInput}
                        onChange={(e) => { setUserEmailInput(e.target.value); setUserError(""); }}
                        placeholder="user@example.com"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Password{" "}
                        {editingUserId
                          ? <span className="text-slate-400">(leave blank to keep current)</span>
                          : <span className="text-rose-500">*</span>}
                      </label>
                      <div className="relative">
                        <input
                          type={showUserPassword ? "text" : "password"}
                          value={userPasswordInput}
                          onChange={(e) => { setUserPasswordInput(e.target.value); setUserError(""); }}
                          placeholder="••••••••"
                          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUserPassword((v) => !v)}
                          className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-slate-600"
                          aria-label={showUserPassword ? "Hide password" : "Show password"}
                        >
                          {showUserPassword ? (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveUser}
                        disabled={userSaving}
                        className="flex flex-1 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {userSaving ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Saving…
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            {editingUserId ? "Update" : "Save"}
                          </>
                        )}
                      </button>
                      {editingUserId && (
                        <button
                          type="button"
                          onClick={handleCancelUserEdit}
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {userError && (
                      <p className="flex items-center gap-1.5 text-xs text-rose-600 sm:col-span-4">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {userError}
                      </p>
                    )}
                  </div>
                </div>

                {/* User list */}
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-slate-900">
                    Users
                    {userList.length > 0 && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {userList.length}
                      </span>
                    )}
                  </h2>

                  {userListLoading ? (
                    <div className="flex items-center justify-center py-10 text-slate-400">
                      <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Loading users…
                    </div>
                  ) : userList.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 py-10 text-center">
                      <Users className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                      <p className="text-sm text-slate-500">No users yet. Add one above.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                            <th className="pb-2 pr-4 font-semibold">#</th>
                            <th className="pb-2 pr-4 font-semibold">Name</th>
                            <th className="pb-2 pr-4 font-semibold">Email</th>
                            <th className="pb-2 pr-4 font-semibold">Password</th>
                            <th className="pb-2 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {userList.map((u, index) => (
                            <tr
                              key={u.id}
                              className={editingUserId === u.id ? "bg-teal-50" : ""}
                            >
                              <td className="py-2.5 pr-4 text-slate-400">{index + 1}</td>
                              <td className="py-2.5 pr-4 font-medium text-slate-900">{u.name}</td>
                              <td className="py-2.5 pr-4 text-slate-600">{u.email}</td>
                              <td className="py-2.5 pr-4 font-mono text-slate-400 tracking-widest text-xs">
                                {"•".repeat(12)}
                              </td>
                              <td className="py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {editingUserId === u.id ? (
                                    <span className="flex items-center gap-1 text-xs font-medium text-teal-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Editing
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleEditUser(u)}
                                      aria-label="Edit user"
                                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u.id)}
                                    aria-label="Delete user"
                                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MOOEBudgetEntry;
