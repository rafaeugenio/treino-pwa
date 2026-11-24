import { createRoot } from "react-dom/client";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { App } from "./app";
import "@/styles/globals.css";
import "./app.css";
createRoot(document.getElementById("root")!).render(
  <DirectionProvider locale="pt-BR">
    <App />
  </DirectionProvider>,
);
