import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./app-theme.css";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { lazy, Suspense } from "react";

const BackgroundRemover = lazy(() => import("@/pages/BackgroundRemover"));
const ImageUpscaler = lazy(() => import("@/pages/ImageUpscaler"));
const Billing = lazy(() => import("@/pages/Billing"));
const Admin = lazy(() => import("@/pages/Admin"));
const Studio = lazy(() => import("@/pages/Studio"));

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster richColors position="top-right" />
        <Suspense fallback={<div className="studio-loading">Loading Sweet AI Lab…</div>}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/studio" component={Studio} />
            <Route path="/background-remover" component={BackgroundRemover} />
            <Route path="/image-upscaler" component={ImageUpscaler} />
            <Route path="/billing" component={Billing} />
            <Route path="/admin" component={Admin} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
