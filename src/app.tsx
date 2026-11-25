import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
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
import * as planoLocal from "./lib/plano";
import { TOTAL, agenda, treinoDoDia, type Plano } from "./lib/plano";
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
function useSwCheckOnVisible(registration: ServiceWorkerRegistration | undefined) {
  const lastCheck = useRef(-Infinity);
  useEffect(() => {
    if (!registration) return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      const now = performance.now();
      if (now - lastCheck.current < SW_CHECK_INTERVAL_MS) return;
      lastCheck.current = now;
      registration.update().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [registration]);
}

const CARD = "flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-6";
const ERRO_DISPOSITIVO = "Não foi possível salvar neste dispositivo.";

function formatDia(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Dia local do aparelho. Recalcula ao voltar ao primeiro plano: o iOS deixa o
// app suspenso de um dia para o outro e o deslize do CA03 depende do dia.
function useHoje() {
  const [dia, setDia] = useState(() => hoje());
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "visible") setDia(hoje());
    };
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return [dia, setDia] as const;
}

type Salvo = { plano: Plano | null; invalido: boolean };
function lerSalvo(): Salvo {
  try {
    return planoLocal.ler(localStorage);
  } catch {
    return { plano: null, invalido: false };
  }
}

// CA03-B3: plano salvo que não pode ser lido. Pede confirmação, guarda o
// conteúdo inválido em backup e começa um plano novo hoje.
// Bari r1: o segundo gesto de um toque duplo, dblclick ou Enter repetido não
// pode cair no Confirmar. No estado de confirmação o lugar do Recomeçar fica
// com o título, o foco vai para o Cancelar e o Confirmar fica por último.
function RecomecarPlano({ onRecomecado }: { onRecomecado: (plano: Plano) => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");
  const recomecarRef = useRef<HTMLButtonElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const voltarFoco = useRef(false);
  useEffect(() => {
    if (confirmando) cancelarRef.current?.focus();
    else if (voltarFoco.current) {
      voltarFoco.current = false;
      recomecarRef.current?.focus();
    }
  }, [confirmando]);
  return (
    <>
      {confirmando ? (
        <section className={CARD} aria-labelledby="recomecar-titulo">
          <h2 id="recomecar-titulo" className="text-title-3-semibold">
            Recomeçar plano?
          </h2>
          <Button
            ref={cancelarRef}
            className="min-h-11"
            variant="secondary"
            onClick={() => {
              voltarFoco.current = true;
              setConfirmando(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            className="min-h-11"
            onClick={() => {
              try {
                onRecomecado(planoLocal.recomecar(localStorage, hoje()));
                setError("");
              } catch {
                setError(ERRO_DISPOSITIVO);
              }
            }}
          >
            Confirmar
          </Button>
        </section>
      ) : (
        <div className={CARD}>
          <Button ref={recomecarRef} className="min-h-11" onClick={() => setConfirmando(true)}>
            Recomeçar plano
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

// CA02 (RAFA-176): treino previsto para hoje e marcar como feito com horas.
function Inicio({
  atividades,
  salvo,
  dia,
  onSincronizar,
  onFeito,
  onRecomecado,
}: {
  atividades: Atividade[];
  salvo: Salvo;
  dia: string;
  onSincronizar: (dia: string, salvo: Salvo) => void;
  onFeito: (resultado: { plano: Plano; atividades: Atividade[] }) => void;
  onRecomecado: (plano: Plano) => void;
}) {
  const [horas, setHoras] = useState("");
  const [error, setError] = useState("");
  const treino = treinoDoDia(salvo.plano, dia);
  return (
    <>
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
          {
            icon: RiCalendarLine,
            label: "Hoje",
            value: treino?.nome ?? "—",
            delta: treino?.feito ? "Feito" : `de ${TOTAL}`,
            deltaColor: treino?.feito ? "lime" : "neutral",
          },
        ]}
      />
      {salvo.invalido && <RecomecarPlano onRecomecado={onRecomecado} />}
      {treino && !treino.feito && (
        <form
          className={CARD}
          onSubmit={(event) => {
            event.preventDefault();
            const valor = parseHoras(horas);
            if (valor === null) return;
            // CA03-B2: vale o dia do aparelho no toque. A tela passa a mostrar
            // o plano salvo nesse dia, já com o deslize, antes de gravar.
            const agora = hoje();
            const atual = lerSalvo();
            flushSync(() => onSincronizar(agora, atual));
            const previsto = treinoDoDia(atual.plano, agora);
            // Plano encerrado (ou treino do dia já feito): o Feito some, sem alerta.
            if (!previsto || previsto.feito) return;
            try {
              onFeito(planoLocal.marcarFeito(localStorage, agora, valor));
              setHoras("");
              setError("");
            } catch {
              setError(ERRO_DISPOSITIVO);
            }
          }}
        >
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
            Feito
          </Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

// CA02 e CA03 (RAFA-176): iniciar na data D e ver os 28 treinos com o deslize.
// CA03-B1: plano válido já iniciado não oferece reiniciar nem trocar a data D.
function PlanoTela({
  salvo,
  dia,
  onIniciado,
}: {
  salvo: Salvo;
  dia: string;
  onIniciado: (plano: Plano) => void;
}) {
  const [inicio, setInicio] = useState(dia);
  const [error, setError] = useState("");
  const { plano } = salvo;
  if (salvo.invalido) return <RecomecarPlano onRecomecado={onIniciado} />;
  if (!plano)
    return (
      <>
        <form
          className={CARD}
          onSubmit={(event) => {
            event.preventDefault();
            try {
              onIniciado(planoLocal.iniciar(localStorage, inicio));
              setError("");
            } catch {
              setError(ERRO_DISPOSITIVO);
            }
          }}
        >
          <Input
            label="Início"
            type="date"
            value={inicio}
            onChange={setInicio}
            isRequired
            errorMessage="Informe a data"
          />
          <Button type="submit" className="min-h-11">
            Iniciar
          </Button>
        </form>
        {error && <p role="alert">{error}</p>}
      </>
    );
  const dias = agenda(plano, dia);
  return (
    <>
      <StatCards
        columns={1}
        stats={[
          {
            icon: RiCheckLine,
            label: "Feitos",
            value: String(plano.feitos.length),
            delta: `de ${TOTAL}`,
            deltaColor: "neutral",
          },
        ]}
      />
      <section className={CARD} aria-label="Treinos do plano">
        <ol data-testid="plano" className="flex flex-col gap-2">
          {dias.map((d) => (
            <li
              key={d.n}
              aria-current={d.data === dia ? "date" : undefined}
              className="flex min-h-11 items-center justify-between gap-3"
            >
              <span className="text-body-medium">{d.nome}</span>
              <span className="flex items-center gap-2">
                {d.feito && <Chip color="lime">Feito</Chip>}
                <Chip color={d.data === dia ? "blue" : "gray"}>{formatDia(d.data)}</Chip>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

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
        className={CARD}
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
            setError(ERRO_DISPOSITIVO);
          }
        }}
      >
        <Input label="Data" type="date" value={data} onChange={setData} isRequired />
        <Input
          label="Atividade"
          value={nome}
          onChange={setNome}
          isRequired
          maxLength={60}
          validate={(valor) => (valor && !valor.trim() ? "Informe a atividade" : null)}
          errorMessage="Informe a atividade"
        />
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
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration>();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration) setSwRegistration(registration);
    },
  });
  useSwCheckOnVisible(swRegistration);
  const [screen, setScreen] = useState<ScreenId>(() => screenFromHash(location.hash));
  const [atividades, setAtividades] = useState<Atividade[]>(() => {
    try {
      return carregar(localStorage);
    } catch {
      return [];
    }
  });
  const [salvo, setSalvo] = useState<Salvo>(lerSalvo);
  const setPlano = (plano: Plano) => setSalvo({ plano, invalido: false });
  const [dia, setDia] = useHoje();
  useEffect(() => {
    const sync = () => setScreen(screenFromHash(location.hash));
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  const select = (id: ScreenId) => {
    setScreen(id);
    history.replaceState(null, "", id === "inicio" ? location.pathname : `#${id}`);
  };
  // Telas sem feature: placeholders com StatCards reais; dados chegam nas RAFA-184 a 186.
  const content: Record<ScreenId, ReactNode> = {
    inicio: (
      <Inicio
        atividades={atividades}
        salvo={salvo}
        dia={dia}
        onSincronizar={(agora, atual) => {
          setDia(agora);
          setSalvo(atual);
        }}
        onRecomecado={setPlano}
        onFeito={(resultado) => {
          setPlano(resultado.plano);
          setAtividades(resultado.atividades);
        }}
      />
    ),
    registro: <Registro atividades={atividades} onSaved={setAtividades} />,
    plano: <PlanoTela salvo={salvo} dia={dia} onIniciado={setPlano} />,
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
