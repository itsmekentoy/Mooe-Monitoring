// App.tsx
import { useState } from "react";
import MOOEStatistics from "./components/MOOEStatistics";
import Login from "./components/Login";

type View = "statistics" | "login";

function App() {
  const [view, setView] = useState<View>("statistics");

  if (view === "login") {
    return (
      <Login
        onLogin={async ({ email, password }) => {
          // TODO: connect to your auth API
          console.log("Login attempt:", email, password);
        }}
      />
    );
  }

  return <MOOEStatistics onSecretTap={() => setView("login")} />;
}

export default App;
