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
  type RemixiconComponentType,
} from "@remixicon/react";
import { StatCards } from "@/components/application/dashboard/stat-cards";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { adicionar, carregar, doDia, formatHoras, hoje, parseHoras, type Atividade } from "./lib/atividades";
import * as dorLocal from "./lib/dor";
import { horas as somarHoras, progresso } from "./lib/estatisticas";
import { ICONES, historico, vazia, type Anotacao } from "./lib/dor";
import { AVISO_IOS, lembrete } from "./lib/lembrete";
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

function formatData(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

// Ação destrutiva com confirmação: Recomeçar plano (CA03-B3 da RAFA-183) e
// Recomeçar anotações de dor (CA03 da RAFA-228). `onConfirmar` guarda o
// conteúdo inválido em backup e grava o novo; se lançar, aparece o alerta.
// Bari r1 (lição 12): o segundo gesto de um toque duplo, dblclick ou Enter
// repetido não pode cair no Confirmar. No estado de confirmação o lugar do
// gatilho fica com o título, o foco vai para o Cancelar e o Confirmar fica por
// último.
// RAFA-247 CA02, via (a): onAbrir avisa a tela que a confirmação abriu, para a
// tela limpar o próprio erro.
// RAFA-251 CA01: com onErro, o erro do Recomecar mora na tela (modo
// controlado), para a tela ter um único alerta, o mais recente; onCancelar
// avisa a tela que a confirmação fechou, para ela limpar o erro do Recomecar.
// Sem onErro, o Recomecar guarda o próprio erro, como antes.
function Recomecar({
  acao,
  tituloId,
  onConfirmar,
  onAbrir,
  erro,
  onErro,
  onCancelar,
}: {
  acao: string;
  tituloId: string;
  onConfirmar: () => void;
  onAbrir?: () => void;
  erro?: string;
  onErro?: (erro: string) => void;
  onCancelar?: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [erroProprio, setErroProprio] = useState("");
  const error = onErro ? (erro ?? "") : erroProprio;
  const setError = onErro ?? setErroProprio;
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
        <section className={CARD} aria-labelledby={tituloId}>
          <h2 id={tituloId} className="text-title-3-semibold">
            {acao}?
          </h2>
          <Button
            ref={cancelarRef}
            className="min-h-11"
            variant="secondary"
            aria-describedby={tituloId}
            onClick={() => {
              voltarFoco.current = true;
              setConfirmando(false);
              onCancelar?.();
            }}
          >
            Cancelar
          </Button>
          <Button
            className="min-h-11"
            onClick={() => {
              try {
                onConfirmar();
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
          <Button
            ref={recomecarRef}
            className="min-h-11"
            onClick={() => {
              onAbrir?.();
              setConfirmando(true);
            }}
          >
            {acao}
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

// CA03-B3: plano salvo que não pode ser lido. Guarda o conteúdo inválido em
// backup e começa um plano novo hoje.
function RecomecarPlano({ onRecomecado }: { onRecomecado: (plano: Plano) => void }) {
  return (
    <Recomecar
      acao="Recomeçar plano"
      tituloId="recomecar-titulo"
      onConfirmar={() => onRecomecado(planoLocal.recomecar(localStorage, hoje()))}
    />
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
  // CA06-1 e CA06-2 (RAFA-186): local, do mesmo estado do Feito; some ao marcar.
  const falta = lembrete(salvo.plano, dia);
  return (
    <>
      {falta && (
        <section
          aria-label="Lembrete"
          data-testid="lembrete"
          className="flex items-center gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-6"
        >
          <RiAlarmLine className="size-6 shrink-0 text-foreground-icon-primary" aria-hidden />
          <span className="text-headline-medium">Falta o {falta}</span>
        </section>
      )}
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
// CA01 (RAFA-228): sem data escolhida à mão, o campo acompanha o dia do
// aparelho e o Salvar grava o dia do toque; a data escolhida à mão fica.
function Registro({
  atividades,
  dia,
  onDia,
  onSaved,
}: {
  atividades: Atividade[];
  dia: string;
  onDia: (dia: string) => void;
  onSaved: (lista: Atividade[]) => void;
}) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const data = escolhida ?? dia;
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
          const gravar = escolhida ?? hoje();
          if (escolhida === null) onDia(gravar);
          try {
            onSaved(adicionar(localStorage, { data: gravar, nome, horas: valor }));
            setNome("");
            setHoras("");
            setError("");
          } catch {
            setError(ERRO_DISPOSITIVO);
          }
        }}
      >
        <Input label="Data" type="date" value={data} onChange={setEscolhida} isRequired />
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

function LinhaHoras({ nome, horas }: { nome: string; horas: number }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-body-medium break-words">{nome}</span>
      <Chip color="gray">{formatHoras(horas)}</Chip>
    </li>
  );
}

// CA01 a CA05 (RAFA-185): horas por atividade, a linha do plano de calistenia
// e o progresso, calculados do mesmo estado que Início, Registro e Plano usam.
function Estatisticas({ atividades, plano }: { atividades: Atividade[]; plano: Plano | null }) {
  const { plano: horasPlano, livres } = somarHoras(atividades);
  const { feitos, total } = progresso(plano);
  return (
    <>
      <StatCards
        columns={1}
        stats={[{ icon: RiCheckLine, label: "Treinos", value: String(feitos), delta: `de ${total}`, deltaColor: "neutral" }]}
      />
      {(horasPlano > 0 || livres.length > 0) && (
        <section className={CARD} aria-label="Horas">
          {horasPlano > 0 && (
            <ul data-testid="horas-plano" className="flex flex-col gap-2">
              <LinhaHoras nome="Plano de calistenia" horas={horasPlano} />
            </ul>
          )}
          {horasPlano > 0 && livres.length > 0 && <hr className="border-separator-border" />}
          {livres.length > 0 && (
            <ul data-testid="horas-livres" className="flex flex-col gap-2">
              {livres.map((linha) => (
                <LinhaHoras key={linha.nome} {...linha} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

// CA04 (RAFA-176), CA04-1 a CA04-4 (RAFA-184): dor ou desconforto do dia, com
// ícones da lista fixa e/ou texto livre, e o histórico dos dias com dor.
// CA03 (RAFA-228): chave de dor ilegível mostra Recomeçar anotações de dor.
function Dor({
  dores,
  ilegivel,
  onSaved,
}: {
  dores: Anotacao[];
  ilegivel: boolean;
  onSaved: (lista: Anotacao[]) => void;
}) {
  const [data, setData] = useState(() => hoje());
  const [icones, setIcones] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [semDor, setSemDor] = useState(false);
  // RAFA-251 CA01: um único erro na tela, com a origem. Um erro novo substitui
  // o anterior, então nunca há dois role=alert.
  const [erro, setErro] = useState<{ texto: string; origem: "salvar" | "recomecar" } | null>(null);
  const dias = historico(dores);
  const alternar = (id: string) => {
    setSemDor(false);
    setIcones((atual) => (atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id]));
  };
  return (
    <>
      {ilegivel && (
        <Recomecar
          acao="Recomeçar anotações de dor"
          tituloId="recomecar-dor-titulo"
          onAbrir={() => setErro(null)}
          erro={erro?.origem === "recomecar" ? erro.texto : ""}
          onErro={(texto) => setErro(texto ? { texto, origem: "recomecar" } : null)}
          onCancelar={() => setErro((atual) => (atual?.origem === "recomecar" ? null : atual))}
          onConfirmar={() => {
            onSaved(dorLocal.recomecar(localStorage));
            setErro(null);
          }}
        />
      )}
      <form
        className={CARD}
        onSubmit={(event) => {
          event.preventDefault();
          // CA04-2: nada marcado e nada escrito, nada é gravado.
          if (vazia({ icones, texto })) {
            setSemDor(true);
            return;
          }
          try {
            onSaved(dorLocal.adicionar(localStorage, { data, icones, texto }));
            setIcones([]);
            setTexto("");
            setErro(null);
          } catch {
            setErro({ texto: ERRO_DISPOSITIVO, origem: "salvar" });
          }
        }}
      >
        <Input label="Data" type="date" value={data} onChange={setData} isRequired errorMessage="Informe a data" />
        <div role="group" aria-label="Ícones" className="flex flex-wrap gap-2">
          {ICONES.map(({ id, nome, icone }) => {
            const marcado = icones.includes(id);
            return (
              <Button
                key={id}
                variant={marcado ? "primary" : "secondary"}
                leadingIcon={icone}
                aria-pressed={marcado}
                className="min-h-11"
                onClick={() => alternar(id)}
              >
                {nome}
              </Button>
            );
          })}
        </div>
        <Input
          label="Texto"
          value={texto}
          onChange={(valor) => {
            setSemDor(false);
            setTexto(valor);
          }}
          isInvalid={semDor}
          errorMessage="Marque ou escreva a dor"
        />
        <Button type="submit" className="min-h-11">
          Salvar
        </Button>
      </form>
      <section className={CARD} aria-label="Histórico">
        {dias.length ? (
          <ol data-testid="historico" className="flex flex-col gap-4">
            {dias.map((dia) => (
              <li key={dia.data} className="flex flex-col gap-2">
                <h2 className="text-headline-medium">{formatData(dia.data)}</h2>
                <ul className="flex flex-col gap-2">
                  {dia.anotacoes.map((anotacao) => (
                    <li key={anotacao.id} className="flex flex-wrap items-center gap-2">
                      {anotacao.icones.map((id) => {
                        const item = ICONES.find((i) => i.id === id);
                        const Icone = item?.icone;
                        return (
                          <Chip key={id} color="rose" className="gap-1">
                            {Icone && <Icone className="size-4" aria-hidden />}
                            {item?.nome ?? id}
                          </Chip>
                        );
                      })}
                      {anotacao.texto && (
                        <span className="text-body-regular break-words">{anotacao.texto}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body-regular text-text-secondary">Nenhuma dor</p>
        )}
      </section>
      {erro?.origem === "salvar" && <p role="alert">{erro.texto}</p>}
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
  const [dor, setDor] = useState<{ anotacoes: Anotacao[]; ilegivel: boolean }>(() => {
    try {
      return dorLocal.ler(localStorage);
    } catch {
      return { anotacoes: [], ilegivel: false };
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
    registro: <Registro atividades={atividades} dia={dia} onDia={setDia} onSaved={setAtividades} />,
    plano: <PlanoTela salvo={salvo} dia={dia} onIniciado={setPlano} />,
    dor: (
      <Dor
        dores={dor.anotacoes}
        ilegivel={dor.ilegivel}
        onSaved={(anotacoes) => setDor({ anotacoes, ilegivel: false })}
      />
    ),
    estatisticas: <Estatisticas atividades={atividades} plano={salvo.plano} />,
    // CA06-3 (RAFA-186): só a linha da limitação do iOS, sem botão nem opção (D2).
    lembretes: (
      <section aria-label="Aviso" className="rounded-2xl bg-background-secondary-default p-4">
        <p data-testid="aviso-ios" className="text-body-regular">
          {AVISO_IOS}
        </p>
      </section>
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
