// App.tsx
import { useState } from "react";
import MOOEStatistics from "./components/MOOEStatistics";
import Login from "./components/Login";
import MooeBudgetEntry from "./components/Mooebudgetentry";
import { login, getSession, clearSession, type AuthUser } from "./lib/auth";

type View = "statistics" | "login" | "budget-entry";

function App() {
  // Initialise from sessionStorage so a page refresh keeps the user logged in
  const [user, setUser] = useState<AuthUser | null>(() => getSession());
  const [view, setView] = useState<View>(() => {
    // If a valid session exists, go straight to budget-entry
    return getSession() ? "budget-entry" : "statistics";
  });

  const handleLogin = async ({ email, password }: { email: string; password: string }) => {
    const authUser = await login(email, password); // throws on failure
    setUser(authUser);
    setView("budget-entry");
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setView("statistics");
  };

  if (view === "login") {
    return <Login onLogin={handleLogin} />;
  }

  if (view === "budget-entry" && user) {
    return <MooeBudgetEntry user={user} onLogout={handleLogout} />;
  }

  return <MOOEStatistics onSecretTap={() => setView("login")} />;
}

export default App;
