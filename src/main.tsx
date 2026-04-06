import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const renderApp = () => {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    console.error("main.tsx: root element not found! Attempting to create one...");
    const newRoot = document.createElement("div");
    newRoot.id = "root";
    document.body.appendChild(newRoot);
    createRoot(newRoot).render(<App />);
  } else {
    try {
      const root = createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
      console.log("Aaroksha Health Hub initialized successfully.");
    } catch (err) {
      console.error("main.tsx: Error during rendering:", err);
      rootElement.innerHTML = `<div style="padding: 20px; color: red;"><h1>Critical Error: Failed to render application</h1><pre>${err instanceof Error ? err.stack : String(err)}</pre></div>`;
    }
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderApp);
} else {
  renderApp();
}
