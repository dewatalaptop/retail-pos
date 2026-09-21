import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { BugBoundary } from "./BugBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BugBoundary>
      <App />
    </BugBoundary>
  </StrictMode>
);
