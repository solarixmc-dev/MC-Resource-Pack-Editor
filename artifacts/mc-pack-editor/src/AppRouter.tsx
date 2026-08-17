import { Route, Router } from "wouter";
import LaunchPage from "./pages/LaunchPage";
import EditorPage from "./pages/EditorPage";
import LibraryPage from "./pages/LibraryPage";
import Navigation from "./components/Navigation";

function AppContent() {
  return (
    <>
      <Route path="/" component={() => (
        <>
          <Navigation />
          <LaunchPage />
        </>
      )} />
      <Route path="/editor" component={EditorPage} />
      <Route path="/library" component={LibraryPage} />
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
