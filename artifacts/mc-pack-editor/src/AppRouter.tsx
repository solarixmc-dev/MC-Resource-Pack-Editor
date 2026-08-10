import { Route, Router } from "wouter";
import LaunchPage from "./pages/LaunchPage";
import EditorPage from "./pages/EditorPage";
import LibraryPage from "./pages/LibraryPage";
import AuthPage from "./pages/AuthPage";
import Navigation from "./components/Navigation";

export default function App() {
  return (
    <Router>
      <Route path="/" component={() => (
        <>
          <Navigation />
          <LaunchPage />
        </>
      )} />
      <Route path="/editor" component={EditorPage} />
      <Route path="/library" component={() => (
        <>
          <Navigation />
          <LibraryPage />
        </>
      )} />
      <Route path="/auth" component={() => (
        <>
          <Navigation />
          <AuthPage />
        </>
      )} />
    </Router>
  );
}
