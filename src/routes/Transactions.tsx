import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import Decimal from 'decimal.js'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { neonFetch, neonMutate } from '../lib/neon'
import type { TransacaoRow, Transacao, TipoAtivo } from '../core/types'
import {
  ajustarTransacoes,
  AVISO_PRE_2010,
  type EventoAjuste,
} from '../core/ajustarTransacoes'
import { baixarCsvTransacoes } from '../core/exportCsv'
import {
  baixarModeloImportacaoCsv,
  importarCsv,
  LINHA_EXEMPLO_IMPORTACAO,
  type ResultadoImportacao,
} from '../core/importCsv'
import { Button, Card } from '../components'

interface Ativo {
  ticker: string
  tickerCotacao: string
  tipo: TipoAtivo
  nome: string
  negociavel: boolean
}

type FilterType = 'all' | 'ACAO' | 'FII' | 'archived'

interface PreviewImportacao extends ResultadoImportacao {
  nomeArquivo: string
}

function lerArquivoTexto(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result ?? ''))
    leitor.onerror = () =>
      reject(leitor.error ?? new Error('Falha ao ler o arquivo.'))
    leitor.readAsText(arquivo, 'utf-8')
  })
}

function formatarValorImportado(valor: string): string {
  const decimal = new Decimal(valor)
  const casas = Math.min(Math.max(decimal.decimalPlaces(), 2), 6)
  const [inteiro, fracao] = decimal.toFixed(casas).split('.')
  const inteiroFormatado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${inteiroFormatado},${fracao}`
}

export function Transactions() {
  const { user } = useAuth()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [eventos, setEventos] = useState<EventoAjuste[]>([])
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [archived, setArchived] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formTicker, setFormTicker] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formValor, setFormValor] = useState('')
  const [formQty, setFormQty] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [formAjustadaManualmente, setFormAjustadaManualmente] = useState(false)
  const [formPre2010Ciente, setFormPre2010Ciente] = useState(false)

  // Import CSV state
  const [showImport, setShowImport] = useState(false)
  const [previewImport, setPreviewImport] = useState<PreviewImportacao | null>(null)
  const [importFileError, setImportFileError] = useState('')
  const [importando, setImportando] = useState(false)
  const [importSucesso, setImportSucesso] = useState('')

  async function fetchData() {
    if (!user) return
    try {
      const [rows, ativosData, arquivamentos] = await Promise.all([
        neonFetch<TransacaoRow[]>(`/transacoes?userId=eq.${user.id}&select=*&order=data.desc`, user.jwt),
        neonFetch<Ativo[]>('/ativos?select=ticker,tickerCotacao,tipo,nome,negociavel', user.jwt),
        neonFetch<{ transacaoId: string }[]>(`/arquivamentos?userId=eq.${user.id}&select=transacaoId`, user.jwt),
      ])
      const ativosMap = Object.fromEntries(ativosData.map(a => [a.ticker, a]))
      const txs: Transacao[] = rows.map(r => ({
        ...r,
        tickerCotacao: ativosMap[r.ativoTicker]?.tickerCotacao ?? r.ativoTicker,
        tipo: ativosMap[r.ativoTicker]?.tipo ?? 'ACAO',
      }))
      setTransacoes(txs)
      setAtivos(ativosData)
      setArchived(new Set(arquivamentos.map(a => a.transacaoId)))

      const tickersEventos = [
        ...new Set(txs.flatMap(t =>
          t.ativoTicker === t.tickerCotacao
            ? [t.ativoTicker]
            : [t.ativoTicker, t.tickerCotacao],
        )),
      ]
      if (tickersEventos.length > 0) {
        const eventosData = await neonFetch<EventoAjuste[]>(
          `/eventos_corporativos?ticker=in.(${tickersEventos.join(',')})&tipo=in.(SPLIT,GRUPAMENTO,BONIFICACAO)&select=ticker,data_efetiva,fator_ajuste,tipo&order=data_efetiva.asc`,
          user.jwt,
        )
        setEventos(eventosData)
      } else {
        setEventos([])
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleDelete(id: string) {
    if (!user) return
    if (!confirm('Remover esta transação?')) return
    try {
      await neonMutate(`/transacoes?id=eq.${id}`, user.jwt, null, 'DELETE')
      setTransacoes(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      alert(String(e))
    }
  }

  async function handleArchive(id: string) {
    if (!user) return
    const isArchived = archived.has(id)
    try {
      if (isArchived) {
        await neonMutate(`/arquivamentos?transacaoId=eq.${id}&userId=eq.${user.id}`, user.jwt, null, 'DELETE')
        setArchived(prev => { const s = new Set(prev); s.delete(id); return s })
      } else {
        await neonMutate('/arquivamentos', user.jwt, { transacaoId: id, userId: user.id })
        setArchived(prev => new Set([...prev, id]))
      }
    } catch (e) {
      alert(String(e))
    }
  }

  function openNewForm() {
    setEditingId(null)
    setFormTicker('')
    setFormDate(new Date().toISOString().slice(0, 10))
    setFormValor('')
    setFormQty('')
    setFormError('')
    setFormAjustadaManualmente(false)
    setFormPre2010Ciente(false)
    setShowForm(v => !v)
  }

  function handleEditStart(tx: Transacao) {
    setEditingId(tx.id)
    setFormTicker(tx.ativoTicker)
    setFormDate(tx.data)
    setFormValor(tx.valorUnitario)
    setFormQty(String(tx.quantidade))
    setFormError('')
    // Sempre desmarcado: o usuário precisa optar explicitamente por não ajustar.
    setFormAjustadaManualmente(false)
    setFormPre2010Ciente(false)
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!user || !formTicker) return

    setFormLoading(true)
    try {
      if (editingId) {
        await neonMutate(`/transacoes?id=eq.${editingId}`, user.jwt, {
          data: formDate,
          valorUnitario: formValor,
          quantidade: parseInt(formQty, 10),
          ajustadaManualmente: formAjustadaManualmente,
        }, 'PATCH')
      } else {
        const ativo = ativos.find(a => a.ticker === formTicker)
        if (!ativo) return
        await neonMutate('/transacoes', user.jwt, {
          userId: user.id,
          ativoTicker: ativo.ticker,
          data: formDate,
          valorUnitario: formValor,
          quantidade: parseInt(formQty, 10),
          ajustadaManualmente: false,
        })
      }
      setShowForm(false)
      setEditingId(null)
      setFormValor('')
      setFormQty('')
      setFormAjustadaManualmente(false)
      setFormPre2010Ciente(false)
      await fetchData()
    } catch (err) {
      setFormError(String(err))
    } finally {
      setFormLoading(false)
    }
  }

  const ajustadas = ajustarTransacoes(transacoes, eventos)

  const filtered = ajustadas.filter(t => {
    const isArchived = archived.has(t.id)
    if (filter === 'archived') return isArchived
    if (filter === 'all') return !isArchived
    return t.tipo === filter && !isArchived
  })

  function handleExportCsv() {
    baixarCsvTransacoes(ajustarTransacoes(transacoes, eventos))
  }

  function toggleImport() {
    setShowImport((valor) => !valor)
    setImportFileError('')
  }

  async function handleImportFile(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    setImportFileError('')
    setImportSucesso('')
    try {
      const texto = await lerArquivoTexto(arquivo)
      setPreviewImport({
        ...importarCsv(texto, ativos, transacoes),
        nomeArquivo: arquivo.name,
      })
    } catch (erro) {
      setPreviewImport(null)
      setImportFileError(String(erro))
    } finally {
      evento.target.value = ''
    }
  }

  async function handleImportar() {
    if (
      !user ||
      !previewImport ||
      previewImport.erros.length > 0 ||
      previewImport.linhas.length === 0
    ) {
      return
    }

    setImportando(true)
    setImportFileError('')
    try {
      const linhas = previewImport.linhas
      await neonMutate(
        '/transacoes',
        user.jwt,
        linhas.map((linha) => ({
          userId: user.id,
          ativoTicker: linha.ativoTicker,
          data: linha.data,
          valorUnitario: linha.valorUnitario,
          quantidade: linha.quantidade,
          ajustadaManualmente: false,
        })),
      )
      setShowImport(false)
      setPreviewImport(null)
      setImportSucesso(
        `${linhas.length} ${
          linhas.length === 1
            ? 'transação importada'
            : 'transações importadas'
        }.`,
      )
      await fetchData()
    } catch (erro) {
      setImportFileError(String(erro))
    } finally {
      setImportando(false)
    }
  }

  const importTemErros = (previewImport?.erros.length ?? 0) > 0
  const podeImportar =
    !!previewImport &&
    !importTemErros &&
    previewImport.linhas.length > 0 &&
    !importando

  const FILTER_CHIPS: { label: string; value: FilterType }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Ações', value: 'ACAO' },
    { label: 'FIIs', value: 'FII' },
    { label: 'Arquivados', value: 'archived' },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface-card border-b border-border-subtle px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <p className="font-body text-xs text-text-secondary uppercase tracking-widest">meus ativos</p>
            <h1 className="font-display font-semibold text-text-primary text-lg leading-tight">Transações</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="h-9 px-3 text-xs flex items-center gap-1"
            onClick={handleExportCsv}
            disabled={transacoes.length === 0}
            title="Exportar todas as transações em CSV"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Exportar CSV
          </Button>
          <Button
            variant="secondary"
            className="h-9 px-3 text-xs flex items-center gap-1"
            onClick={toggleImport}
            title="Importar transações via CSV"
            aria-label="Importar transações via CSV"
            aria-expanded={showImport}
          >
            <span className="material-symbols-outlined text-[16px]">upload</span>
            <span className="hidden sm:inline">Importar CSV</span>
          </Button>
          <Button
            variant="primary"
            className="h-9 px-3 text-xs flex items-center gap-1"
            onClick={openNewForm}
          >
            <span className="material-symbols-outlined text-[16px]">{showForm ? 'close' : 'add'}</span>
            Nova Transação
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading && <p className="text-text-secondary font-body text-sm">Carregando...</p>}
        {error && <p className="text-alert font-body text-sm">{error}</p>}

        {importSucesso && (
          <div
            role="status"
            className="rounded-xl border border-equity/40 bg-equity/10 px-4 py-3 flex items-center justify-between gap-3"
          >
            <p className="font-body text-sm text-equity">{importSucesso}</p>
            <button
              onClick={() => setImportSucesso('')}
              className="text-equity hover:opacity-70 transition-opacity"
              aria-label="Fechar aviso de importação"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Import CSV panel */}
        {showImport && (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-yield/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-yield text-[18px]">upload_file</span>
                </div>
                <span className="font-display font-semibold text-text-primary">Importar Transações</span>
              </div>
              <button
                onClick={toggleImport}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Fechar importação"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-body text-sm text-text-secondary">
                Use o arquivo modelo com separador <code>;</code>, datas{' '}
                <code>AAAA-MM-DD</code> e vírgula decimal. Exemplo de linha:
              </p>
              <code className="block overflow-x-auto rounded-lg border border-border-subtle bg-bg-base px-3 py-2 font-mono text-xs text-text-primary">
                {LINHA_EXEMPLO_IMPORTACAO}
              </code>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 px-3 text-xs flex items-center gap-1"
                  onClick={baixarModeloImportacaoCsv}
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Baixar modelo CSV
                </Button>
                <label className="h-9 px-3 rounded-xl border border-border-subtle bg-transparent text-text-primary font-body font-semibold text-xs tracking-wide flex items-center gap-1 cursor-pointer hover:bg-surface-elevated transition-colors">
                  <span className="material-symbols-outlined text-[16px]">attach_file</span>
                  Selecionar arquivo
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleImportFile}
                    disabled={loading}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {importFileError && (
              <p className="text-alert font-body text-xs">{importFileError}</p>
            )}

            {previewImport && (
              <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-base p-3">
                <p className="font-body text-xs text-text-secondary">
                  <span className="text-text-primary font-semibold">
                    {previewImport.nomeArquivo}
                  </span>
                  {' — '}
                  {previewImport.linhas.length}{' '}
                  {previewImport.linhas.length === 1
                    ? 'transação válida'
                    : 'transações válidas'}
                  {previewImport.duplicadas.length > 0 &&
                    `, ${previewImport.duplicadas.length} ${
                      previewImport.duplicadas.length === 1
                        ? 'duplicata ignorada'
                        : 'duplicatas ignoradas'
                    }`}
                  {previewImport.erros.length > 0 &&
                    `, ${previewImport.erros.length} ${
                      previewImport.erros.length === 1
                        ? 'erro encontrado'
                        : 'erros encontrados'
                    }`}
                  .
                </p>

                {importTemErros && (
                  <div className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-2">
                    <p className="font-body text-xs font-semibold text-alert">
                      Corrija os erros e selecione o arquivo novamente. Nenhuma
                      transação será importada.
                    </p>
                    <ul className="mt-2 space-y-1">
                      {previewImport.erros.slice(0, 20).map((erro, indice) => (
                        <li
                          key={`${erro.linha}-${indice}`}
                          className="font-body text-xs text-alert"
                        >
                          Linha {erro.linha}: {erro.mensagem}
                        </li>
                      ))}
                    </ul>
                    {previewImport.erros.length > 20 && (
                      <p className="mt-2 font-body text-xs text-alert">
                        Mais {previewImport.erros.length - 20} erros não
                        exibidos.
                      </p>
                    )}
                  </div>
                )}

                {previewImport.duplicadas.length > 0 && (
                  <div className="rounded-lg border border-yield/40 bg-yield/10 px-3 py-2">
                    <p className="font-body text-xs text-yield">
                      Duplicatas não serão importadas:
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {previewImport.duplicadas.slice(0, 10).map((duplicada) => (
                        <li
                          key={duplicada.linha}
                          className="font-body text-xs text-yield"
                        >
                          Linha {duplicada.linha}:{' '}
                          {duplicada.motivo === 'existente'
                            ? 'já cadastrada'
                            : 'repetida no arquivo'}
                          .
                        </li>
                      ))}
                    </ul>
                    {previewImport.duplicadas.length > 10 && (
                      <p className="mt-1 font-body text-xs text-yield">
                        Mais {previewImport.duplicadas.length - 10} duplicatas
                        não exibidas.
                      </p>
                    )}
                  </div>
                )}

                {!importTemErros && previewImport.linhas.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-body text-xs">
                      <thead>
                        <tr className="text-text-tertiary uppercase tracking-widest">
                          <th className="py-1 pr-2 font-medium">Linha</th>
                          <th className="py-1 pr-2 font-medium">Ticker</th>
                          <th className="py-1 pr-2 font-medium">Data</th>
                          <th className="py-1 pr-2 font-medium">Tipo</th>
                          <th className="py-1 pr-2 font-medium">Valor</th>
                          <th className="py-1 font-medium">Qtd.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewImport.linhas.slice(0, 10).map((linha) => (
                          <tr
                            key={linha.linha}
                            className="border-t border-border-subtle text-text-primary"
                          >
                            <td className="py-1 pr-2 font-mono tabular-nums">{linha.linha}</td>
                            <td className="py-1 pr-2">{linha.ativoTicker}</td>
                            <td className="py-1 pr-2 font-mono tabular-nums">{linha.data}</td>
                            <td className="py-1 pr-2">
                              {linha.tipo === 'ACAO' ? 'Ação' : 'FII'}
                            </td>
                            <td className="py-1 pr-2 font-mono tabular-nums">
                              R$ {formatarValorImportado(linha.valorUnitario)}
                            </td>
                            <td className="py-1 font-mono tabular-nums">{linha.quantidade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewImport.linhas.length > 10 && (
                      <p className="mt-2 font-body text-xs text-text-secondary">
                        Mais {previewImport.linhas.length - 10} linhas não
                        exibidas.
                      </p>
                    )}
                  </div>
                )}

                {!importTemErros && previewImport.linhas.length === 0 && (
                  <p className="font-body text-xs text-text-secondary">
                    Nenhuma transação nova para importar.
                  </p>
                )}

                {previewImport.erros.length === 0 &&
                  previewImport.linhas.length > 0 && (
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full flex items-center justify-center gap-2"
                      disabled={!podeImportar}
                      onClick={handleImportar}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {importando ? 'hourglass_top' : 'upload'}
                      </span>
                      {importando
                        ? 'Importando...'
                        : `Importar ${previewImport.linhas.length} ${
                            previewImport.linhas.length === 1
                              ? 'transação'
                              : 'transações'
                          }`}
                    </Button>
                  )}
              </div>
            )}
          </Card>
        )}

        {/* New transaction form */}
        {showForm && (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-equity/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-equity text-[18px]">{editingId ? 'edit' : 'add_circle'}</span>
              </div>
              <span className="font-display font-semibold text-text-primary">{editingId ? 'Editar Transação' : 'Nova Compra'}</span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Asset select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-text-secondary font-body text-xs uppercase tracking-widest" htmlFor="asset-select">
                  Ativo (Código B3)
                </label>
                <div className="relative">
                  <select
                    id="asset-select"
                    required
                    disabled={!!editingId}
                    value={formTicker}
                    onChange={e => setFormTicker(e.target.value)}
                    className="w-full h-12 bg-bg-base border border-border-subtle text-text-primary font-body text-sm rounded-xl px-4 appearance-none outline-none focus:border-yield transition-colors disabled:opacity-50"
                  >
                    <option value="" disabled>Selecione um ativo...</option>
                    {ativos.filter(a => a.negociavel).map(a => (
                      <option key={a.ticker} value={a.ticker}>
                        [{a.tipo === 'ACAO' ? 'Ação' : 'FII'}] {a.ticker} — {a.nome}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-3.5 text-text-secondary pointer-events-none text-[20px]">expand_more</span>
                </div>
              </div>

              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-text-secondary font-body text-xs uppercase tracking-widest" htmlFor="trade-date">
                  Data do Pregão
                </label>
                <div className="relative">
                  <input
                    id="trade-date"
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full h-12 bg-bg-base border border-border-subtle text-text-primary font-body text-sm rounded-xl px-4 outline-none focus:border-yield transition-colors"
                  />
                </div>
              </div>

              {formDate && formDate < '2010-01-01' && (
                <div className="rounded-xl border border-yield/40 bg-yield/10 px-4 py-3">
                  <p className="font-body text-xs text-yield leading-snug">
                    O app tem dados de eventos corporativos confiáveis a partir de 2010.
                    Splits, grupamentos ou bonificações entre a data da compra e 2010 não
                    são considerados no cálculo automático. Ajuste manualmente se necessário.
                  </p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPre2010Ciente}
                      onChange={e => setFormPre2010Ciente(e.target.checked)}
                      className="accent-yield"
                    />
                    <span className="font-body text-xs text-text-primary">
                      Entendi, registrar mesmo assim
                    </span>
                  </label>
                </div>
              )}

              {/* Qty + Price grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-secondary font-body text-xs uppercase tracking-widest" htmlFor="input-qty">
                    Quantidade
                  </label>
                  <div className="relative">
                    <input
                      id="input-qty"
                      type="number"
                      min="1"
                      step="1"
                      required
                      placeholder="100"
                      value={formQty}
                      onChange={e => setFormQty(e.target.value)}
                      className="w-full h-12 bg-bg-base border border-border-subtle text-text-primary font-mono text-sm rounded-xl px-4 outline-none focus:border-yield transition-colors tabular-nums"
                    />
                    <span className="absolute right-3 top-3.5 text-text-secondary text-xs pointer-events-none">un</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-secondary font-body text-xs uppercase tracking-widest" htmlFor="input-price">
                    Preço Unit. (R$)
                  </label>
                  <input
                    id="input-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="34,50"
                    value={formValor}
                    onChange={e => setFormValor(e.target.value)}
                    className="w-full h-12 bg-bg-base border border-border-subtle text-text-primary font-mono text-sm rounded-xl px-4 outline-none focus:border-yield transition-colors tabular-nums"
                  />
                </div>
              </div>

              {editingId && (
                <label
                  className="flex items-start gap-2 rounded-xl border border-border-subtle bg-bg-base px-4 py-3 cursor-pointer"
                  title="Marque se você já ajustou manualmente a quantidade ou o preço médio para refletir splits/grupamentos/bonificações. Desmarcado, o app aplica os fatores automaticamente."
                >
                  <input
                    type="checkbox"
                    checked={formAjustadaManualmente}
                    onChange={e => setFormAjustadaManualmente(e.target.checked)}
                    className="mt-0.5 accent-yield"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-body text-xs text-text-primary">
                      Esta transação já reflete eventos corporativos (não ajustar automaticamente)
                    </span>
                    <span className="font-body text-[11px] text-text-tertiary">
                      Marque se você já ajustou manualmente a quantidade ou o preço médio
                      para refletir splits/grupamentos/bonificações. Desmarcado, o app
                      aplica os fatores automaticamente.
                    </span>
                  </span>
                </label>
              )}

              {/* Total display */}
              <div className="bg-bg-base rounded-xl px-4 py-3 flex items-center justify-between border border-border-subtle">
                <div>
                  <p className="text-text-secondary font-body text-xs uppercase tracking-widest">Total Estimado</p>
                  <p className="text-text-tertiary font-body text-xs">Líquido sem taxas B3</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-equity font-body font-bold text-sm">R$</span>
                  <span className="text-equity font-mono text-2xl font-semibold tabular-nums">
                    {formValor && formQty
                      ? (parseFloat(formValor) * parseInt(formQty, 10)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                      : '0,00'}
                  </span>
                </div>
              </div>

              {formError && <p className="text-alert font-body text-xs">{formError}</p>}

              <Button type="submit" variant="primary" disabled={formLoading} className="w-full flex items-center justify-center gap-2 mt-1">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                {formLoading ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Confirmar Compra'}
              </Button>
            </form>
          </Card>
        )}

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => setFilter(chip.value)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full font-body text-xs font-medium flex items-center gap-1.5 transition-colors
                ${filter === chip.value
                  ? 'bg-surface-elevated text-text-primary font-semibold'
                  : 'bg-surface-card text-text-secondary hover:text-text-primary border border-border-subtle'}`}
            >
              {chip.value === 'ACAO' && <span className="w-2 h-2 rounded-full bg-equity inline-block" />}
              {chip.value === 'FII' && <span className="w-2 h-2 rounded-full bg-yield inline-block" />}
              {chip.value === 'archived' && <span className="material-symbols-outlined text-[14px]">archive</span>}
              {chip.label}
            </button>
          ))}
        </div>

        {/* Transactions list */}
        {!loading && (
          <div className="space-y-3">
            {filtered.length === 0 && (
              <Card className="flex flex-col items-center justify-center py-10 text-center gap-3">
                <span className="material-symbols-outlined text-text-tertiary text-[32px]">folder_off</span>
                <p className="font-display font-semibold text-text-primary">Nenhuma ordem encontrada</p>
                <p className="font-body text-sm text-text-secondary max-w-xs">Não há lançamentos para os filtros selecionados.</p>
              </Card>
            )}

            {filtered.map(tx => {
              const isArchived = archived.has(tx.id)
              const isAcao = tx.tipo === 'ACAO'
              const total = (parseFloat(tx.valorUnitario) * tx.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              const prefix = tx.ativoTicker.slice(0, 2).toUpperCase()
              const fatorExibicao = tx.fatorAcumulado !== 1
              const quantidadeExibida = fatorExibicao ? tx.quantidadeAjustada : tx.quantidade
              const valorUnitarioExibido = fatorExibicao
                ? parseFloat(tx.valorUnitarioAjustado)
                : parseFloat(tx.valorUnitario)
              const tooltipOriginal = fatorExibicao
                ? `Original: ${tx.quantidade} ${isAcao ? 'ações' : 'cotas'} a R$ ${parseFloat(tx.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (antes de splits/grupamentos/bonificações)`
                : undefined

              return (
                <Card key={tx.id} className={`flex flex-col gap-3 ${isArchived ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center font-body font-bold text-sm ${isAcao ? 'text-equity' : 'text-yield'}`}>
                        {prefix}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/ativos/${tx.tickerCotacao}`}
                            className="font-display font-semibold text-text-primary hover:text-equity transition-colors"
                            title={`Ver histórico de ${tx.tickerCotacao}`}
                          >
                            {tx.ativoTicker}
                          </Link>
                          <span className={`px-2 py-0.5 rounded-full font-body text-xs font-semibold ${isAcao ? 'bg-equity/15 text-equity' : 'bg-yield/15 text-yield'}`}>
                            {isAcao ? 'Ação' : 'FII'}
                          </span>
                          {tx.data < '2010-01-01' && (
                            <span
                              className="px-2 py-0.5 rounded-full border border-border-subtle bg-surface-elevated text-text-secondary font-body text-[10px] font-semibold"
                              title={AVISO_PRE_2010}
                            >
                              Pré-2010
                            </span>
                          )}
                          {tx.ajustadaManualmente && (
                            <span
                              className="px-2 py-0.5 rounded-full border border-border-subtle bg-surface-elevated text-text-secondary font-body text-[10px] font-semibold"
                              title="Esta transação já reflete eventos corporativos e não recebe ajuste automático."
                            >
                              Ajustada manualmente
                            </span>
                          )}
                        </div>
                        <span className="font-body text-xs text-text-secondary" title={tooltipOriginal}>
                          {quantidadeExibida} {isAcao ? 'ações' : 'cotas'} · R$ {valorUnitarioExibido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono font-semibold text-text-primary tabular-nums">{total}</span>
                      <span className="font-body text-xs text-text-tertiary">
                        {new Date(tx.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border-subtle">
                    <button
                      onClick={() => handleEditStart(tx)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-card text-text-secondary font-body text-xs flex items-center gap-1 transition-colors"
                      title="Editar transação"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      Editar
                    </button>
                    <button
                      onClick={() => handleArchive(tx.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-card text-text-secondary font-body text-xs flex items-center gap-1 transition-colors"
                      title={isArchived ? 'Desarquivar' : 'Arquivar'}
                    >
                      <span className="material-symbols-outlined text-[14px]">{isArchived ? 'unarchive' : 'inventory_2'}</span>
                      {isArchived ? 'Desarquivar' : 'Arquivar'}
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-alert/10 text-alert font-body text-xs flex items-center gap-1 transition-colors"
                      title="Remover transação"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                      Remover
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
