// App.tsx
import { useState } from "react";
import MOOEStatistics from "./components/MOOEStatistics";
import Login from "./components/Login";
import MooeBudgetEntry from "./components/Mooebudgetentry";

type View = "statistics" | "login" | "budget-entry";

function App() {
  const [view, setView] = useState<View>("statistics");

  if (view === "login") {
    return (
      <Login
        onLogin={async () => {
          setView("budget-entry");
        }}
      />
    );
  }

  if (view === "budget-entry") {
    return <MooeBudgetEntry />;
  }

  return <MOOEStatistics onSecretTap={() => setView("login")} />;
}

export default App;
