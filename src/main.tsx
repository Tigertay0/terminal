import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Apply the saved theme before the first paint, so screens shown before the
// terminal (sign-in, mode select) match it too. useTheme keeps it in sync after.
try {
  const saved = localStorage.getItem("rochambeau-theme") ?? localStorage.getItem("bb-terminal-theme");
  document.documentElement.classList.add(saved === "light" ? "light" : "dark");
} catch {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
