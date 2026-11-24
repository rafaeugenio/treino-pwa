import { useEffect, useState, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  RiAlarmLine,
  RiBarChart2Line,
  RiCalendarLine,
  RiCheckLine,
  RiEditLine,
  RiFirstAidKitLine,
  RiHome5Line,
  RiTimeLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { StatCards } from "@/components/application/dashboard/stat-cards";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { load, save } from "./lib/storage";
import { SCREENS, screenFromHash, type ScreenId } from "./screens";

const ICONS: Record<ScreenId, RemixiconComponentType> = {
  inicio: RiHome5Line,
  registro: RiEditLine,
  plano: RiCalendarLine,
  dor: RiFirstAidKitLine,
  estatisticas: RiBarChart2Line,
  lembretes: RiAlarmLine,
};

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

// Prova local do CA07 (RAFA-180). O registro completo é da RAFA-182.
function Registro({ record, onSaved }: { record: string; onSaved: (value: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <form
        className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-6"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            save(localStorage, value);
            onSaved(value.trim());
            setValue("");
            setError("");
          } catch {
            setError("Não foi possível salvar neste dispositivo.");
          }
        }}
      >
        <Input label="Registro" value={value} onChange={setValue} isRequired maxLength={160} />
        <Button type="submit" className="min-h-11">
          Salvar treino
        </Button>
      </form>
      <section
        className="rounded-3xl border border-border-button-default bg-background-primary-default p-6"
        aria-label="Último registro"
      >
        <h2 className="text-headline-medium">Último registro</h2>
        <p data-testid="record" className="text-body-regular break-words" role="status">
          {record || "Nenhum registro"}
        </p>
      </section>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

export function App() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration) checkSwOnVisible(registration);
    },
  });
  const [screen, setScreen] = useState<ScreenId>(() => screenFromHash(location.hash));
  const [record, setRecord] = useState(() => {
    try {
      return load(localStorage);
    } catch {
      return "";
    }
  });
  useEffect(() => {
    const sync = () => setScreen(screenFromHash(location.hash));
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  const select = (id: ScreenId) => {
    setScreen(id);
    history.replaceState(null, "", id === "inicio" ? location.pathname : `#${id}`);
  };
  // Telas sem feature: placeholders com StatCards reais; dados chegam nas RAFA-182 a 186.
  const content: Record<ScreenId, ReactNode> = {
    inicio: (
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
    ),
    registro: <Registro record={record} onSaved={setRecord} />,
    plano: (
      <StatCards
        columns={1}
        stats={[{ icon: RiCalendarLine, label: "Dia", value: "0", delta: "de 28", deltaColor: "neutral" }]}
      />
    ),
    dor: (
      <StatCards
        columns={1}
        stats={[{ icon: RiFirstAidKitLine, label: "Registros", value: "0", delta: "Local", deltaColor: "neutral" }]}
      />
    ),
    estatisticas: (
      <StatCards
        columns={2}
        stats={[
          { icon: RiCheckLine, label: "Treinos", value: "0", delta: "de 28", deltaColor: "neutral" },
          { icon: RiTimeLine, label: "Horas", value: "0", delta: "Total", deltaColor: "neutral" },
        ]}
      />
    ),
    lembretes: (
      <StatCards
        columns={1}
        stats={[{ icon: RiAlarmLine, label: "Ativos", value: "0", delta: "Local", deltaColor: "neutral" }]}
      />
    ),
  };
  return (
    <main className="flex flex-col gap-6 text-text-primary">
      {needRefresh && (
        <Button className="min-h-11 min-w-11" onClick={() => void updateServiceWorker(true)}>
          Atualizar
        </Button>
      )}
      <Tabs selectedKey={screen} onSelectionChange={(key) => select(key as ScreenId)} className="gap-6">
        {SCREENS.map(({ id, title }) => (
          <TabPanel key={id} id={id} className="flex flex-col gap-6" data-screen={id}>
            <h1 className="text-title-1-medium">{title}</h1>
            {content[id]}
          </TabPanel>
        ))}
        <nav className="app-nav border-t border-separator-border bg-background-full">
          <TabList aria-label="Telas" className="justify-between gap-0 border-b-0">
            {SCREENS.map(({ id, title }) => {
              const Icon = ICONS[id];
              return (
                <Tab key={id} id={id} aria-label={title} className="min-h-11 min-w-11 flex-1 justify-center">
                  <Icon className="size-6" aria-hidden />
                </Tab>
              );
            })}
          </TabList>
        </nav>
      </Tabs>
    </main>
  );
}
