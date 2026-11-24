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
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { adicionar, carregar, doDia, formatHoras, hoje, parseHoras, type Atividade } from "./lib/atividades";
import { SCREENS, screenFromHash, type ScreenId } from "./screens";

const ICONS: Record<ScreenId, RemixiconComponentType> = {
  inicio: RiHome5Line,
  registro: RiEditLine,
  plano: RiCalendarLine,
  dor: RiFirstAidKitLine,
  estatisticas: RiBarChart2Line,
  lembretes: RiAlarmLine,
};

// CA01 (RAFA-176): atividade do dia com data, nome e horas, salva no aparelho.
function Registro({ atividades, onSaved }: { atividades: Atividade[]; onSaved: (lista: Atividade[]) => void }) {
  const [data, setData] = useState(() => hoje());
  const [nome, setNome] = useState("");
  const [horas, setHoras] = useState("");
  const [error, setError] = useState("");
  const lista = doDia(atividades, data);
  return (
    <>
      <form
        className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const valor = parseHoras(horas);
          if (valor === null || !nome.trim() || !data) return;
          try {
            onSaved(adicionar(localStorage, { data, nome, horas: valor }));
            setNome("");
            setHoras("");
            setError("");
          } catch {
            setError("Não foi possível salvar neste dispositivo.");
          }
        }}
      >
        <Input label="Data" type="date" value={data} onChange={setData} isRequired />
        <Input label="Atividade" value={nome} onChange={setNome} isRequired maxLength={60} />
        <Input
          label="Horas"
          inputMode="decimal"
          value={horas}
          onChange={setHoras}
          isRequired
          validate={(valor) => (valor && parseHoras(valor) === null ? "Horas inválidas" : null)}
          errorMessage="Horas inválidas"
        />
        <Button type="submit" className="min-h-11">
          Salvar
        </Button>
      </form>
      <section
        className="rounded-3xl border border-border-button-default bg-background-primary-default p-6"
        aria-label="Atividades do dia"
      >
        {lista.length ? (
          <ul data-testid="atividades" className="flex flex-col gap-2">
            {lista.map((atividade) => (
              <li key={atividade.id} className="flex min-h-11 items-center justify-between gap-3">
                <span className="text-body-medium break-words">{atividade.nome}</span>
                <Chip color="gray">{formatHoras(atividade.horas)}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-regular text-text-secondary">Nenhuma atividade</p>
        )}
      </section>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

export function App() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [screen, setScreen] = useState<ScreenId>(() => screenFromHash(location.hash));
  const [atividades, setAtividades] = useState<Atividade[]>(() => {
    try {
      return carregar(localStorage);
    } catch {
      return [];
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
  // Telas sem feature: placeholders com StatCards reais; dados chegam nas RAFA-183 a 186.
  const content: Record<ScreenId, ReactNode> = {
    inicio: (
      <StatCards
        columns={1}
        stats={[
          {
            icon: RiCheckLine,
            label: "Atividades",
            value: String(atividades.length),
            delta: "Local",
            deltaColor: "neutral",
          },
        ]}
      />
    ),
    registro: <Registro atividades={atividades} onSaved={setAtividades} />,
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
