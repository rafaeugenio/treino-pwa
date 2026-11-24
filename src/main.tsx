import { createRoot } from "react-dom/client";
import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { StatCards } from "@/components/application/dashboard/stat-cards";
import { RiCheckLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { load, save } from "./lib/storage";
import "@/styles/globals.css";
import "./app.css";
// O iOS deixa o app instalado suspenso por horas; ao voltar ao primeiro plano
// o navegador não busca o SW novo sozinho. Checa no retorno, no máximo a cada
// 60 s e só online. A primeira volta depois de abrir sempre checa.
const SW_CHECK_INTERVAL_MS = 60_000;
let watchedRegistration: ServiceWorkerRegistration | undefined;
function checkSwOnVisible(registration: ServiceWorkerRegistration) {
  if (watchedRegistration === registration) return;
  watchedRegistration = registration;
  let lastCheck = -Infinity;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !navigator.onLine) return;
    const now = Date.now();
    if (now - lastCheck < SW_CHECK_INTERVAL_MS) return;
    lastCheck = now;
    registration.update().catch(() => undefined);
  });
}
function App() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration) checkSwOnVisible(registration);
    },
  });
  const [record, setRecord] = useState(() => {
    try {
      return load(localStorage);
    } catch {
      return "";
    }
  });
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="flex flex-col gap-6 text-text-primary">
      <h1 className="text-title-1-medium">Treino</h1>
      {needRefresh && (
        <Button className="min-h-11 min-w-11" onClick={() => void updateServiceWorker(true)}>
          Atualizar
        </Button>
      )}
      <StatCards
        columns={1}
        stats={[
          {
            icon: RiCheckLine,
            label: "Registros salvos",
            value: record ? "1" : "0",
            delta: "Local",
            deltaColor: "neutral",
          },
        ]}
      />
      <form
        className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-6"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            save(localStorage, value);
            setRecord(value.trim());
            setValue("");
            setError("");
          } catch {
            setError("Não foi possível salvar neste dispositivo.");
          }
        }}
      >
        <Input
          label="Registro"
          value={value}
          onChange={setValue}
          isRequired
          maxLength={160}
        />
        <Button type="submit" className="min-h-11">
          Salvar treino
        </Button>
      </form>
      <section
        className="rounded-3xl border border-border-button-default bg-background-primary-default p-6"
        aria-label="Último registro"
      >
        <h2 className="text-headline-medium">Último registro</h2>
        <p
          data-testid="record"
          className="text-body-regular break-words"
          role="status"
        >
          {record || "Nenhum registro"}
        </p>
      </section>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <DirectionProvider locale="pt-BR">
    <App />
  </DirectionProvider>,
);
