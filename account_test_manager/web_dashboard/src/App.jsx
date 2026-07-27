import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileWarning,
  Gauge,
  ListChecks,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react'

const defaultState = {
  version: '—',
  status: 'ready',
  status_label: 'Conectando ao motor local',
  current_index: 0,
  total_scenarios: 0,
  elapsed_seconds: 0,
  logs: [],
  last_log_id: 0,
  error_message: '',
}

const statusMeta = {
  ready: { label: 'Pronto', tone: 'neutral' },
  running: { label: 'Executando', tone: 'live' },
  paused: { label: 'Pausado', tone: 'warning' },
  completed: { label: 'Concluído', tone: 'success' },
  stopped: { label: 'Interrompido', tone: 'warning' },
  error: { label: 'Falha', tone: 'danger' },
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span className="brand-n brand-n-left" />
      <span className="brand-n brand-n-slash" />
      <span className="brand-n brand-n-right" />
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'purple' }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-icon"><Icon size={19} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <button type="button" className="toggle-row" onClick={() => onChange(!checked)}>
      <span className={`toggle ${checked ? 'toggle-on' : ''}`}><i /></span>
      <span><strong>{label}</strong><small>{description}</small></span>
    </button>
  )
}

function App() {
  const [activePage, setActivePage] = useState('automation')
  const [settings, setSettings] = useState(null)
  const [scenarioText, setScenarioText] = useState('')
  const [personNamesText, setPersonNamesText] = useState('')
  const [defaultPersonNamesText, setDefaultPersonNamesText] = useState('')
  const [state, setState] = useState(defaultState)
  const [logs, setLogs] = useState([])
  const [successes, setSuccesses] = useState([])
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [reportType, setReportType] = useState('successes')
  const [search, setSearch] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const consoleRef = useRef(null)
  const lastLogRef = useRef(0)

  useEffect(() => {
    request('/api/bootstrap')
      .then((data) => {
        setSettings(data.saved.settings)
        setScenarioText(data.saved.scenario_text)
        setPersonNamesText(data.saved.person_names_text || '')
        setDefaultPersonNamesText(data.defaults?.person_names_text || data.saved.person_names_text || '')
        setState(data.state)
        setLogs(data.state.logs || [])
        lastLogRef.current = data.state.last_log_id || 0
        setSuccesses(data.successes || [])
        setErrors(data.errors || [])
      })
      .catch((error) => showNotice('error', error.message))
  }, [])

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const next = await request(`/api/state?after=${lastLogRef.current}`)
        setState(next)
        if (next.logs?.length) {
          setLogs((current) => [...current, ...next.logs].slice(-1500))
          lastLogRef.current = next.last_log_id
        }
        if (['completed', 'error', 'stopped'].includes(next.status)) refreshReports()
      } catch {
        // A próxima leitura recupera o estado quando o servidor estiver disponível.
      }
    }, 850)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs])

  const reportRows = reportType === 'successes' ? successes : errors
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return [...reportRows].reverse()
    return [...reportRows].reverse().filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(term)),
    )
  }, [reportRows, search])

  const successRate = successes.length + errors.length
    ? Math.round((successes.length / (successes.length + errors.length)) * 100)
    : 0
  const running = state.status === 'running'
  const paused = state.status === 'paused'
  const active = running || paused
  const progress = state.total_scenarios
    ? Math.min(100, Math.round((state.current_index / state.total_scenarios) * 100))
    : 0
  const meta = statusMeta[state.status] || statusMeta.ready
  const pageTitle = activePage === 'automation'
    ? 'Automacao de contas'
    : activePage === 'names'
      ? 'Banco de nomes'
      : 'Relatorios de execucao'
  const personNames = useMemo(() => {
    const seen = new Set()
    return personNamesText
      .split(/\r?\n/)
      .map((name) => name.replace(/\s+/g, ' ').trim())
      .filter((name) => {
        const key = name.toLowerCase()
        if (!name || seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [personNamesText])

  function showNotice(type, message) {
    setNotice({ type, message })
    window.setTimeout(() => setNotice(null), 4200)
  }

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function runAction(action) {
    setBusy(action)
    try {
      if (action === 'validate' || action === 'start') {
        const result = await request(`/api/${action}`, {
          method: 'POST',
          body: JSON.stringify({ settings, scenario_text: scenarioText, person_names_text: personNamesText }),
        })
        if (result.person_names_text) setPersonNamesText(result.person_names_text)
        if (action === 'validate') {
          showNotice('success', `${result.scenario_count} cenario(s), ${result.name_count || personNames.length} nome(s) e templates validados.`)
        } else {
          setLogs([])
          lastLogRef.current = 0
          showNotice('success', 'Automação iniciada com segurança.')
        }
      } else {
        await request(`/api/${action}`, { method: 'POST', body: '{}' })
      }
    } catch (error) {
      showNotice('error', error.message)
    } finally {
      setBusy('')
    }
  }

  async function saveNames() {
    setBusy('names')
    try {
      const result = await request('/api/names', {
        method: 'POST',
        body: JSON.stringify({ person_names_text: personNamesText }),
      })
      if (result.person_names_text) setPersonNamesText(result.person_names_text)
      showNotice('success', `${result.name_count || personNames.length} nome(s) salvos.`)
    } catch (error) {
      showNotice('error', error.message)
    } finally {
      setBusy('')
    }
  }

  async function resetApp() {
    if (!window.confirm('Resetar todo o app? O CSV de contas sera exportado antes de limpar os dados.')) return
    setBusy('reset')
    try {
      const result = await request('/api/reset', { method: 'POST', body: '{}' })
      setSettings(result.saved.settings)
      setScenarioText(result.saved.scenario_text || '')
      setPersonNamesText(result.saved.person_names_text || '')
      setState(result.state || defaultState)
      setLogs([])
      lastLogRef.current = 0
      setSuccesses(result.successes || [])
      setErrors(result.errors || [])
      if (result.download_url) {
        window.location.href = result.download_url
        showNotice('success', 'App resetado. CSV de contas exportado automaticamente.')
      } else {
        showNotice('success', 'App resetado. Nao havia contas para exportar.')
      }
    } catch (error) {
      showNotice('error', error.message)
    } finally {
      setBusy('')
    }
  }

  async function refreshReports() {
    try {
      const data = await request('/api/reports')
      setSuccesses(data.successes || [])
      setErrors(data.errors || [])
    } catch {
      // Mantém a última visualização válida.
    }
  }

  if (!settings) {
    return (
      <main className="loading-screen">
        <BrandMark />
        <LoaderCircle className="spin" />
        <p>Preparando o NORDLYS</p>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div><strong>NORDLYS</strong><span>Account Manager</span></div>
        </div>
        <nav>
          <button className={activePage === 'automation' ? 'active' : ''} onClick={() => setActivePage('automation')}>
            <Gauge size={19} /><span>Automação</span>
          </button>
          <button className={activePage === 'names' ? 'active' : ''} onClick={() => setActivePage('names')}>
            <ListChecks size={19} /><span>Nomes</span><em>{personNames.length}</em>
          </button>
          <button className={activePage === 'reports' ? 'active' : ''} onClick={() => { setActivePage('reports'); refreshReports() }}>
            <Database size={19} /><span>Relatórios</span><em>{successes.length + errors.length}</em>
          </button>
        </nav>
        <div className="sidebar-foot">
          <div className="engine-state"><span className={`status-dot ${running ? 'pulse' : ''}`} /><div><small>Motor local</small><strong>Online · v{state.version}</strong></div></div>
          <p><ShieldCheck size={15} /> Dados armazenados localmente</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">CENTRAL DE OPERAÇÕES</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className={`status-pill status-${meta.tone}`}><span />{meta.label}</div>
        </header>

        {activePage === 'automation' ? (
          <>
            <section className="hero-panel">
              <div className="hero-glow" />
              <div className="hero-copy">
                <span className="hero-kicker"><Zap size={15} /> OPENCV + FIREFOX CONTAINERS</span>
                <h2>{state.status_label}</h2>
                <p>{active ? `Cenário ${state.current_index} de ${state.total_scenarios} · ${state.elapsed_seconds}s decorridos` : 'Configure as proxies, valide os dados e inicie quando estiver pronto.'}</p>
              </div>
              <div className="hero-actions">
                {!active && <button className="btn btn-primary btn-large" disabled={busy} onClick={() => runAction('start')}><Play size={18} fill="currentColor" /> Iniciar automação</button>}
                {running && <button className="btn btn-soft btn-large" onClick={() => runAction('pause')}><Pause size={18} fill="currentColor" /> Pausar</button>}
                {paused && <button className="btn btn-primary btn-large" onClick={() => runAction('resume')}><Play size={18} fill="currentColor" /> Continuar</button>}
                {active && <button className="btn btn-danger btn-icon" title="Parar" onClick={() => runAction('stop')}><Square size={17} fill="currentColor" /></button>}
              </div>
              <div className="hero-progress"><span style={{ width: `${progress}%` }} /></div>
            </section>

            <section className="metrics-grid">
              <MetricCard icon={FileCheck2} label="Cadastros aprovados" value={successes.length} detail="Confirmados pelo OpenCV" tone="green" />
              <MetricCard icon={FileWarning} label="Erros tratados" value={errors.length} detail="Tentativas recuperadas" tone="red" />
              <MetricCard icon={Activity} label="Taxa de sucesso" value={`${successRate}%`} detail="Histórico registrado" />
              <MetricCard icon={Clock3} label="Tempo da sessão" value={`${state.elapsed_seconds}s`} detail={active ? 'Contagem em tempo real' : 'Aguardando execução'} tone="blue" />
            </section>

            <section className="workspace-grid">
              <article className="card config-card">
                <div className="card-head">
                  <div><span className="section-icon"><Server size={18} /></span><div><h3>Fila de proxies</h3><p>JSON estruturado ou lista crua</p></div></div>
                  <button className="btn btn-ghost" disabled={busy || active} onClick={() => runAction('validate')}><Check size={16} /> Validar</button>
                </div>
                <textarea className="scenario-editor" value={scenarioText} disabled={active} spellCheck="false" onChange={(event) => setScenarioText(event.target.value)} />
                <div className="editor-foot">
                  <span><Users size={15} /> Os nomes usados vem da aba Nomes</span>
                  <span className="line-chip">Início: linha {settings.start_line}</span>
                </div>
              </article>

              <article className="card console-card">
                <div className="card-head">
                  <div><span className="section-icon"><Terminal size={18} /></span><div><h3>Console ao vivo</h3><p>Eventos do motor Python</p></div></div>
                  <span className="live-label"><i /> LIVE</span>
                </div>
                <div className="console" ref={consoleRef}>
                  {logs.length === 0 && <div className="console-empty"><Terminal size={28} /><span>Os eventos da próxima execução aparecerão aqui.</span></div>}
                  {logs.map((entry) => <div className="log-line" key={entry.id}><time>{entry.time}</time><span>{entry.text}</span></div>)}
                </div>
              </article>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <span className="section-icon"><ListChecks size={18} /></span>
                  <div><h3>Nomes Processados nesta Sessão</h3><p>Proxies criados, pulados ou que falharam</p></div>
                </div>
              </div>
              <div className="processed-scenarios" style={{ padding: '0 16px 16px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(!state.processed_scenarios || state.processed_scenarios.length === 0) && (
                  <span style={{ color: 'var(--gray-text)' }}>Nenhum proxy processado ainda.</span>
                )}
                {state.processed_scenarios && state.processed_scenarios.map((scenario, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '500',
                    backgroundColor: scenario.status === 'success' ? 'var(--green-bg)' : scenario.status === 'error' ? 'var(--red-bg)' : 'var(--gray-bg)',
                    color: scenario.status === 'success' ? 'var(--green-text)' : scenario.status === 'error' ? 'var(--red-text)' : 'var(--gray-text)',
                    border: '1px solid',
                    borderColor: scenario.status === 'success' ? 'var(--green-border)' : scenario.status === 'error' ? 'var(--red-border)' : 'var(--gray-border)'
                  }}>
                    {scenario.status === 'success' ? <CheckCircle2 size={14} /> : scenario.status === 'error' ? <AlertTriangle size={14} /> : <RotateCcw size={14} />}
                    {scenario.name}
                  </div>
                ))}
              </div>
            </section>

            <section className="card settings-card">
              <button className="settings-summary" onClick={() => setAdvancedOpen((value) => !value)}>
                <span className="section-icon"><Settings2 size={18} /></span>
                <span><strong>Configurações da automação</strong><small>Caminhos, tempos, validação de IP e site alvo</small></span>
                <ChevronDown className={advancedOpen ? 'rotate' : ''} size={19} />
              </button>
              {advancedOpen && (
                <div className="settings-body">
                  <div className="form-grid form-grid-wide">
                    <Field label="Firefox"><input value={settings.firefox} onChange={(e) => updateSetting('firefox', e.target.value)} /></Field>
                    <Field label="Perfil Firefox" hint="Opcional"><input value={settings.profile} onChange={(e) => updateSetting('profile', e.target.value)} /></Field>
                    <Field label="Pasta de templates"><input value={settings.templates} onChange={(e) => updateSetting('templates', e.target.value)} /></Field>
                    <Field label="URL do site de teste"><input value={settings.target_url} placeholder="https://..." onChange={(e) => updateSetting('target_url', e.target.value)} /></Field>
                    <Field label="Tipo da lista crua"><select value={settings.raw_scheme} onChange={(e) => updateSetting('raw_scheme', e.target.value)}><option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks5">SOCKS5</option></select></Field>
                  </div>
                  <div className="form-grid numeric-grid">
                    <Field label="Confiança OpenCV"><input type="number" step="0.01" value={settings.confidence} onChange={(e) => updateSetting('confidence', e.target.value)} /></Field>
                    <Field label="Pausa entre ações"><input type="number" step="0.05" value={settings.pause_seconds} onChange={(e) => updateSetting('pause_seconds', e.target.value)} /></Field>
                    <Field label="Espera do Firefox"><input type="number" step="0.1" value={settings.startup_wait} onChange={(e) => updateSetting('startup_wait', e.target.value)} /></Field>
                    <Field label="Espera do painel"><input type="number" step="0.05" value={settings.panel_wait} onChange={(e) => updateSetting('panel_wait', e.target.value)} /></Field>
                    <Field label="Começar na linha"><input type="number" min="1" value={settings.start_line} onChange={(e) => updateSetting('start_line', e.target.value)} /></Field>
                  </div>
                  <div className="toggles-grid">
                    <Toggle checked={settings.startup_panels} onChange={(value) => updateSetting('startup_panels', value)} label="Preparar o Firefox" description="Fecha avisos iniciais conhecidos" />
                  </div>
                  <div className="danger-zone">
                    <div><strong>Reset geral</strong><small>Exporta o CSV de contas e limpa estado, nomes salvos, memoria e relatorios locais.</small></div>
                    <button className="btn btn-danger" disabled={busy || active} onClick={resetApp}><Trash2 size={16} /> Resetar app</button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : activePage === 'names' ? (
          <section className="names-page">
            <article className="card names-card">
              <div className="card-head">
                <div><span className="section-icon"><Users size={18} /></span><div><h3>Lista de nomes</h3><p>Um nome por linha, usado nos containers e nas tentativas do cadastro</p></div></div>
                <div className="names-actions">
                  <span className="name-count">{personNames.length} nomes validos</span>
                  <button className="btn btn-ghost" disabled={active || !defaultPersonNamesText} onClick={() => setPersonNamesText(defaultPersonNamesText)}><RotateCcw size={16} /> Restaurar</button>
                  <button className="btn btn-primary" disabled={busy || active} onClick={saveNames}><Check size={16} /> Salvar nomes</button>
                </div>
              </div>
              <textarea className="names-editor" value={personNamesText} disabled={active} spellCheck="false" onChange={(event) => setPersonNamesText(event.target.value)} />
              <div className="editor-foot">
                <span><ListChecks size={15} /> A automacao remove linhas vazias e duplicadas ao salvar</span>
                <span className="line-chip">Disponiveis: {personNames.length}</span>
              </div>
            </article>
          </section>
        ) : (
          <section className="reports-page">
            <div className="report-toolbar">
              <div className="segmented">
                <button className={reportType === 'successes' ? 'active' : ''} onClick={() => setReportType('successes')}><CheckCircle2 size={16} /> Sucessos <span>{successes.length}</span></button>
                <button className={reportType === 'errors' ? 'active' : ''} onClick={() => setReportType('errors')}><AlertTriangle size={16} /> Erros <span>{errors.length}</span></button>
              </div>
              <div className="report-actions">
                <label className="search-box"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nos registros" /></label>
                <button className="btn btn-ghost" onClick={() => setShowPasswords((value) => !value)}>{showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}{showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}</button>
                <a className="btn btn-ghost" href="/api/download/successes"><Download size={16} /> Exportar contas</a>
                <a className="btn btn-primary" href={`/api/download/${reportType}`}><Download size={16} /> Baixar CSV</a>
              </div>
            </div>
            <article className="card report-card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data e hora</th><th>Cenário</th><th>Tentativa</th><th>Usuário</th><th>Gmail</th><th>Senha</th><th>{reportType === 'successes' ? 'Proxy' : 'Contagem'}</th></tr></thead>
                  <tbody>
                    {filteredRows.map((row, index) => (
                      <tr key={`${row.timestamp}-${index}`}>
                        <td><span className="date-cell">{row.timestamp?.replace('T', ' ').slice(0, 19)}</span></td>
                        <td><strong>{row.scenario_name}</strong></td>
                        <td><span className="attempt-chip">#{row.attempt_number}</span></td>
                        <td className="mono">{row.username}</td>
                        <td>{row.email}</td>
                        <td className="mono password-cell">{showPasswords ? row.password : '••••••••••••'}</td>
                        <td>{reportType === 'successes' ? <span className="proxy-cell">{row.proxy_host}:{row.proxy_port}</span> : <span className="error-count">{row.total_error_count}º erro</span>}</td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && <tr><td colSpan="7"><div className="empty-table"><Database size={28} /><strong>Nenhum registro encontrado</strong><span>Os próximos resultados aparecerão automaticamente aqui.</span></div></td></tr>}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}
      </main>

      {notice && <div className={`toast toast-${notice.type}`}>{notice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<span>{notice.message}</span></div>}
    </div>
  )
}

export default App
