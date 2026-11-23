import { createRoot } from "react-dom/client";
import { useState } from "react";
import { StatCards } from "@/components/application/dashboard/stat-cards";
import { RiCheckLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { load, save } from "./lib/storage";
import "@/styles/globals.css";
import "./app.css";
function App() {
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
