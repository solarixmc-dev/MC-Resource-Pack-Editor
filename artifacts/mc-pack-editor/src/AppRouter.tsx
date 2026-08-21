import { Route, Router } from "wouter";
import LaunchPage from "./pages/LaunchPage";
import EditorPage from "./pages/EditorPage";
import LibraryPage from "./pages/LibraryPage";
import ContactPage from "./pages/ContactPage";
import AnalyzerPage from "./pages/AnalyzerPage";
import Navigation from "./components/Navigation";

function AppContent() {
  return (
    <>
      <Navigation />
      <Route path="/" component={LaunchPage} />
      <Route path="/editor" component={EditorPage} />
      <Route path="/analyzer" component={AnalyzerPage} />
      <Route path="/library" component={LibraryPage} />
      <Route path="/contact" component={ContactPage} />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
