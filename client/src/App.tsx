import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./app-theme.css";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import BackgroundRemover from "@/pages/BackgroundRemover";
import Billing from "@/pages/Billing";
import Admin from "@/pages/Admin";
import Studio from "@/pages/Studio";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster richColors position="top-right" />
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/studio" component={Studio} />
          <Route path="/background-remover" component={BackgroundRemover} />
          <Route path="/billing" component={Billing} />
          <Route path="/admin" component={Admin} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
