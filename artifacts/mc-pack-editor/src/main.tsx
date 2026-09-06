import { createRoot } from "react-dom/client";
import AppRouter from "./AppRouter";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "./components/ui/toaster";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <AppRouter />
      <Toaster />
    </AuthProvider>
  </ThemeProvider>
);
