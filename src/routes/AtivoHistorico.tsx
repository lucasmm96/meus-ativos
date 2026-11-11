import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../lib/auth'
import { neonFetch } from '../lib/neon'
import { Card } from '../components'
import {
  PERIODOS,
  deveExibirAvisoCobertura,
  deveExibirBadgeFii,
  eventoTerminal,
  filtrarPorPeriodo,
  formatarData,
  formatarFatorEvento,
  montarSerieGrafico,
  temFatorAjuste,
  textoEventoTerminal,
  tipoEventoHumano,
  type AtivoInfo,
  type CotacaoAjustada,
  type EventoCorporativo,
  type Periodo,
} from '../core/ativoHistorico'
import {
  calcularCAGR,
  calcularDrawdownMaximo,
  calcularFaixa52Semanas,
  calcularRetornoPeriodo,
  calcularVolatilidade,
} from '../core/indicadores'

const COR_ALTA = '#6cba3b'
const COR_BAIXA = '#8a8a8a'
const COR_EVENTO = '#f59e0b'

interface RotuloEventoProps {
  viewBox?: { x?: number; y?: number; width?: number; height?: number }
  texto?: string
  detalhe?: string
}

function RotuloEvento({ viewBox, texto, detalhe }: RotuloEventoProps) {
  if (!viewBox || viewBox.x == null) return null
  return (
    <g>
      <title>{detalhe}</title>
      <text
        x={viewBox.x}
        y={14}
        fill={COR_EVENTO}
        fontSize={10}
        textAnchor="middle"
      >
        {texto}
      </text>
    </g>
  )
}

function formatarPercentual(valor: number | null): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return `${(valor * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

function formatarPreco(valor: string | number | null): string {
  if (valor == null) return '—'
  const numero = typeof valor === 'string' ? parseFloat(valor) : valor
  if (!Number.isFinite(numero)) return '—'
  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarEixoX(timestamp: number, dias: number): string {
  const data = new Date(timestamp)
  if (Number.isNaN(data.getTime())) return String(timestamp)
  if (dias <= 400) {
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }
  return String(data.getFullYear())
}

function formatarTimestamp(timestamp: number): string {
  const data = new Date(timestamp)
  if (Number.isNaN(data.getTime())) return String(timestamp)
  return data.toLocaleDateString('pt-BR')
}

function timestampDeIso(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime()
}

function legendaEvento(evento: EventoCorporativo): string {
  const fator = formatarFatorEvento(evento.fator_ajuste)
  const tipo = fator
    ? `${tipoEventoHumano(evento.tipo)} ${fator}`
    : tipoEventoHumano(evento.tipo)
  const base = `${tipo} em ${formatarData(evento.data_efetiva)}`
  return evento.descricao ? `${base} — ${evento.descricao}` : base
}

export function AtivoHistorico() {
  const { ticker: tickerParam } = useParams<{ ticker: string }>()
  const ticker = (tickerParam ?? '').toUpperCase()
  const { user } = useAuth()

  const [dados, setDados] = useState<CotacaoAjustada[]>([])
  const [eventos, setEventos] = useState<EventoCorporativo[]>([])
  const [ativo, setAtivo] = useState<AtivoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('Tudo')

  useEffect(() => {
    if (!user || !ticker) return
    let cancelado = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const ativosData = await neonFetch<AtivoInfo[]>(
          `/ativos?ticker=eq.${encodeURIComponent(ticker)}&select=ticker,nome,tipo,"tickerCotacao"`,
          user!.jwt,
        )
        if (cancelado) return
        const ativoInfo = ativosData[0] ?? null
        const tickerCotacao = ativoInfo?.tickerCotacao ?? ticker
        const isAlias = tickerCotacao !== ticker

        const urlEventos = isAlias
          ? `/eventos_corporativos?ticker=in.(${encodeURIComponent(ticker)},${encodeURIComponent(tickerCotacao)})&order=data_efetiva.asc&select=tipo,data_efetiva,descricao,ticker_relacionado,fator_ajuste`
          : `/eventos_corporativos?ticker=eq.${encodeURIComponent(ticker)}&order=data_efetiva.asc&select=tipo,data_efetiva,descricao,ticker_relacionado,fator_ajuste`

        const [cotacoes, eventosData] = await Promise.all([
          neonFetch<CotacaoAjustada[]>(
            `/cotacoes_ajustadas?ativoTicker=eq.${encodeURIComponent(tickerCotacao)}&order=data.asc`,
            user!.jwt,
          ),
          neonFetch<EventoCorporativo[]>(urlEventos, user!.jwt),
        ])
        if (cancelado) return
        setDados(cotacoes)
        setEventos(eventosData)
        setAtivo(ativoInfo)
      } catch (e) {
        if (!cancelado) setError(String(e))
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    load()
    return () => {
      cancelado = true
    }
  }, [user, ticker])

  const dadosFiltrados = useMemo(
    () => filtrarPorPeriodo(dados, periodo),
    [dados, periodo],
  )
  const serie = useMemo(
    () =>
      montarSerieGrafico(dadosFiltrados).map((ponto) => ({
        ...ponto,
        timestamp: timestampDeIso(ponto.data),
      })),
    [dadosFiltrados],
  )

  const eventosVisiveis = useMemo(() => {
    if (dadosFiltrados.length === 0) return []
    const inicio = dadosFiltrados[0].data
    const fim = dadosFiltrados[dadosFiltrados.length - 1].data
    return eventos.filter(
      (e) => e.data_efetiva >= inicio && e.data_efetiva <= fim,
    )
  }, [eventos, dadosFiltrados])

  const mostrarCorte2010 =
    dadosFiltrados.length > 0 &&
    dadosFiltrados[0].data <= '2010-01-01' &&
    dadosFiltrados[dadosFiltrados.length - 1].data >= '2010-01-01'

  const ajustada = temFatorAjuste(dadosFiltrados)
  const ehFii = deveExibirBadgeFii(ativo?.tipo)
  const avisoCobertura =
    !ehFii && deveExibirAvisoCobertura(eventos, dados)
  const terminal = eventoTerminal(eventos)

  const retorno = calcularRetornoPeriodo(dadosFiltrados)
  const cagr = calcularCAGR(dadosFiltrados)
  const volatilidade = calcularVolatilidade(dadosFiltrados)
  const ultimoPonto = dados[dados.length - 1] ?? null
  const faixa52s = calcularFaixa52Semanas(dados)
  const drawdown = calcularDrawdownMaximo(dados)
  const retornosPorPeriodo = PERIODOS.map((periodo) => ({
    periodo,
    valor: calcularRetornoPeriodo(filtrarPorPeriodo(dados, periodo)),
  }))

  const diasSerie =
    dadosFiltrados.length > 1
      ? Math.max(
          1,
          Math.round(
            (new Date(`${dadosFiltrados[dadosFiltrados.length - 1].data}T00:00:00`).getTime() -
              new Date(`${dadosFiltrados[0].data}T00:00:00`).getTime()) /
              86_400_000,
          ),
        )
      : 1

  const titulo = ativo?.nome ?? ticker
  const tipoLabel = ativo?.tipo === 'FII' ? 'FII' : 'Ação'

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-surface-card border-b border-border-subtle px-4 py-3 flex items-center gap-2">
        <Link
          to="/"
          className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Voltar ao dashboard"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <p className="font-body text-xs text-text-secondary uppercase tracking-widest">
            meus ativos
          </p>
          <h1 className="font-display font-semibold text-text-primary text-lg leading-tight">
            {titulo}
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {loading && (
          <p className="text-text-secondary font-body text-sm">Carregando...</p>
        )}
        {error && <p className="text-alert font-body text-sm">{error}</p>}

        {!loading && !error && (
          <>
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-body text-xs text-text-secondary uppercase tracking-widest">
                    Histórico ajustado
                  </p>
                  <h2 className="font-display text-xl font-semibold text-text-primary">
                    {titulo}
                  </h2>
                  <p className="font-body text-xs text-text-tertiary">
                    {ticker} · {tipoLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ajustada && (
                    <span className="px-2.5 py-1 rounded-full bg-equity/15 text-equity font-body text-xs font-semibold">
                      Série ajustada
                    </span>
                  )}
                  {ehFii && (
                    <span className="px-2.5 py-1 rounded-full bg-yield/15 text-yield font-body text-xs font-semibold">
                      Série bruta — sem ajuste por eventos
                    </span>
                  )}
                </div>
              </div>

              {ehFii && (
                <p className="font-body text-xs text-yield bg-yield/10 border border-yield/30 rounded-lg px-3 py-2">
                  Eventos corporativos para FIIs não são cobertos por fontes
                  gratuitas. A série exibida é bruta, sem ajuste por eventos.
                </p>
              )}

              {avisoCobertura && (
                <p className="font-body text-xs text-yellow-200 bg-yellow-500/10 border border-yellow-500/40 rounded-lg px-3 py-2">
                  Série pode não estar ajustada. Eventos corporativos históricos
                  para este ativo não foram verificados.
                </p>
              )}

              {terminal && (
                <p className="font-body text-xs text-orange-200 bg-orange-500/10 border border-orange-500/40 rounded-lg px-3 py-2">
                  {textoEventoTerminal(terminal)}
                </p>
              )}
            </Card>

            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-text-secondary">
                  Preço ajustado
                </h3>
                <div className="flex gap-1.5">
                  {PERIODOS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriodo(p)}
                      className={`px-3 py-1 rounded-full font-body text-xs font-medium transition-colors ${
                        periodo === p
                          ? 'bg-equity text-bg-base'
                          : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {dadosFiltrados.length === 0 ? (
                <p className="font-body text-sm text-text-secondary py-10 text-center">
                  Nenhuma cotação encontrada para {ticker}.
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart
                      data={serie}
                      margin={{ top: 24, right: 24, bottom: 8, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        tick={{ fill: '#a0a0a0', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}
                        minTickGap={48}
                        tickFormatter={(valor: number) =>
                          formatarEixoX(valor, diasSerie)
                        }
                      />
                      <YAxis
                        tick={{ fill: '#a0a0a0', fontSize: 11, fontFamily: '"JetBrains Mono", monospace' }}
                        tickFormatter={(valor: number) =>
                          `R$${valor.toLocaleString('pt-BR', {
                            maximumFractionDigits: 0,
                          })}`
                        }
                      />
                      <Tooltip
                        formatter={(valor: number) =>
                          valor.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })
                        }
                        labelFormatter={(label) =>
                          formatarTimestamp(Number(label))
                        }
                      />
                      <Legend />
                      <Line
                        type="linear"
                        dataKey="precoBaixa"
                        name="Pré-2010 (confiabilidade baixa)"
                        stroke={COR_BAIXA}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="linear"
                        dataKey="precoAlta"
                        name="Pós-2010 (confiabilidade alta)"
                        stroke={COR_ALTA}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      {mostrarCorte2010 && (
                        <ReferenceLine
                          x={timestampDeIso('2010-01-01')}
                          stroke="#a0a0a0"
                          strokeDasharray="3 3"
                          label={{
                            value: 'Início da série ajustada',
                            position: 'insideTopLeft',
                            fill: '#a0a0a0',
                            fontSize: 10,
                          }}
                        />
                      )}
                      {eventosVisiveis.map((evento) => (
                        <ReferenceLine
                          key={`${evento.tipo}-${evento.data_efetiva}`}
                          x={timestampDeIso(evento.data_efetiva)}
                          stroke={COR_EVENTO}
                          strokeWidth={1.5}
                          label={
                            <RotuloEvento
                              texto={tipoEventoHumano(evento.tipo)}
                              detalhe={legendaEvento(evento)}
                            />
                          }
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>

                  {eventosVisiveis.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {eventosVisiveis.map((evento) => (
                        <span
                          key={`${evento.tipo}-${evento.data_efetiva}`}
                          title={legendaEvento(evento)}
                          className="px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 font-body text-xs"
                        >
                          {tipoEventoHumano(evento.tipo)} ·{' '}
                          {formatarData(evento.data_efetiva)}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">
                  Fechamento mais recente
                </p>
                <p className="text-text-primary font-mono text-xl font-semibold tabular-nums">
                  {formatarPreco(ultimoPonto?.preco_ajustado ?? null)}
                </p>
                <p className="text-text-tertiary font-body text-xs">
                  {ultimoPonto ? formatarData(ultimoPonto.data) : '—'}
                </p>
              </Card>
              <Card>
                <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">
                  Faixa de 52 semanas
                </p>
                <p className="text-text-primary font-mono text-xl font-semibold tabular-nums">
                  {faixa52s
                    ? `${formatarPreco(faixa52s.minima)} – ${formatarPreco(faixa52s.maxima)}`
                    : '—'}
                </p>
                <div className="relative h-1.5 mt-2 rounded-full bg-surface-elevated">
                  {faixa52s && (
                    <span
                      className="absolute w-2 h-2 rounded-full bg-equity"
                      style={{
                        left: `${faixa52s.posicao * 100}%`,
                        top: '-1px',
                        transform: 'translateX(-50%)',
                      }}
                    />
                  )}
                </div>
              </Card>
              <Card>
                <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">
                  Drawdown máximo
                </p>
                <p
                  className={`font-mono text-xl font-semibold tabular-nums ${
                    drawdown != null && drawdown < 0
                      ? 'text-alert'
                      : 'text-text-primary'
                  }`}
                  title="Maior queda do pico ao fundo na série ajustada pós-2010"
                >
                  {formatarPercentual(drawdown)}
                </p>
                <p className="text-text-tertiary font-body text-xs">
                  Pico ao fundo · série pós-2010
                </p>
              </Card>
            </div>

            <Card>
              <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-text-secondary mb-3">
                Retorno por período
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {retornosPorPeriodo.map(({ periodo, valor }) => (
                  <div key={periodo} className="text-center">
                    <p className="font-body text-xs text-text-secondary">
                      {periodo}
                    </p>
                    <p
                      className={`font-mono text-sm font-semibold tabular-nums ${
                        valor == null
                          ? 'text-text-tertiary'
                          : valor >= 0
                            ? 'text-equity'
                            : 'text-alert'
                      }`}
                    >
                      {formatarPercentual(valor)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="font-body text-[10px] text-text-tertiary text-center mt-2">
                Calculado sobre a série ajustada pós-2010.
              </p>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">
                  Retorno do período
                </p>
                <p className="text-text-primary font-mono text-xl font-semibold tabular-nums">
                  {formatarPercentual(retorno)}
                </p>
              </Card>
              <Card>
                <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">
                  CAGR
                </p>
                <p
                  className="text-equity font-mono text-xl font-semibold tabular-nums"
                  title={
                    cagr == null
                      ? 'Calculado apenas sobre série ajustada (pós-2010)'
                      : undefined
                  }
                >
                  {formatarPercentual(cagr)}
                </p>
              </Card>
              <Card>
                <p className="text-text-secondary font-body text-xs uppercase tracking-widest mb-1">
                  Volatilidade anualizada
                </p>
                <p
                  className="text-text-primary font-mono text-xl font-semibold tabular-nums"
                  title={
                    volatilidade == null
                      ? 'Calculado apenas sobre série ajustada (pós-2010)'
                      : undefined
                  }
                >
                  {formatarPercentual(volatilidade)}
                </p>
              </Card>
            </div>
          </>
        )}

        <footer className="border-t border-border-subtle pt-4 pb-2">
          <p className="font-body text-xs text-text-tertiary text-center">
            Apenas desdobramentos automáticos registrados. Outros eventos
            corporativos podem estar ausentes.
          </p>
        </footer>
      </main>
    </div>
  )
}
