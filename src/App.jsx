import { useEffect, useMemo, useState } from 'react'

const RAW_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://backend-dog-9e63.onrender.com'

const STATUS_POLL_INTERVAL = 15000

function getMachineFromQuery() {
  const params = new URLSearchParams(window.location.search)
  return params.get('maquina') || 'dog1'
}

function getApiBaseUrl() {
  if (typeof window === 'undefined') {
    return RAW_API_BASE_URL
  }

  try {
    const parsedUrl = new URL(RAW_API_BASE_URL, window.location.origin)
    const isLocalApi =
      parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'

    if (import.meta.env.DEV && isLocalApi) {
      return '/api'
    }

    return parsedUrl.toString()
  } catch {
    return RAW_API_BASE_URL
  }
}

function formatLastSeen(value) {
  if (!value) {
    return 'sem registro'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatCountdown(targetDate) {
  if (!targetDate) {
    return null
  }

  const diff = new Date(targetDate).getTime() - Date.now()
  if (diff <= 0) {
    return 'a qualquer momento'
  }

  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}min`)
  if (seconds || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

function buildUrl(path, params) {
  const apiBaseUrl = getApiBaseUrl()
  const url = apiBaseUrl.startsWith('http')
    ? new URL(path, apiBaseUrl)
    : new URL(`${apiBaseUrl}${path}`, window.location.origin)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

export default function App() {
  const machine = useMemo(() => getMachineFromQuery(), [])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [releasing, setReleasing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('')
  const [countdown, setCountdown] = useState(null)

  async function fetchStatus(showLoader = false) {
    if (showLoader) {
      setLoading(true)
    }

    try {
      const response = await fetch(buildUrl('/status', { machine }))
      if (!response.ok) {
        throw new Error('Falha ao consultar o status da máquina.')
      }

      const data = await response.json()
      setStatus(data)
      setError('')
    } catch (err) {
      setError(err.message || 'Não foi possível conectar ao servidor.')
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchStatus(true)
    const interval = setInterval(() => {
      fetchStatus(false)
    }, STATUS_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [machine])

  useEffect(() => {
    if (!status?.scheduledReleaseAt) {
      setCountdown(null)
      return undefined
    }

    const updateCountdown = () => {
      setCountdown(formatCountdown(status.scheduledReleaseAt))
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [status?.scheduledReleaseAt])

  async function handleRelease() {
    const confirmed = window.confirm('Deseja mesmo liberar agora a ração?')
    if (!confirmed) {
      return
    }

    setReleasing(true)
    setMessage('')

    try {
      const response = await fetch(buildUrl('/liberar-racao', { machine }))
      if (!response.ok) {
        throw new Error('Não foi possível solicitar a liberação da ração.')
      }

      const data = await response.json()
      setMessage(data.mensagem || 'Liberação solicitada com sucesso.')
      await fetchStatus(false)
    } catch (err) {
      setError(err.message || 'Falha ao liberar a ração.')
    } finally {
      setReleasing(false)
    }
  }

  async function handleSchedule(event) {
    event.preventDefault()
    setScheduling(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(
        buildUrl('/agendar-racao', { machine, data: date, hora: time }),
      )

      if (!response.ok) {
        throw new Error('Não foi possível agendar a liberação.')
      }

      const data = await response.json()
      setMessage(data.mensagem || 'Liberação agendada com sucesso.')
      await fetchStatus(false)
    } catch (err) {
      setError(err.message || 'Falha ao agendar a ração.')
    } finally {
      setScheduling(false)
    }
  }

  const online = Boolean(status?.online)
  const nextReleaseText =
    countdown ||
    status?.tempoRestanteParaProximaLiberacao ||
    (status?.hasScheduledRelease ? 'agendada' : null)

  return (
    <main className="app-shell">
      <section className="panel">
        <p className="machine-chip">Máquina: {machine}</p>
        <div className="title-row">
          <div>
            <h1>Alimentador LC</h1>
            {nextReleaseText ? (
              <p className="next-release">
                Próxima liberação em <strong>{nextReleaseText}</strong>
              </p>
            ) : null}
          </div>
          <div className="status-box" aria-live="polite">
            <span className={`status-dot ${online ? 'online' : 'offline'}`} />
            <div>
              <p className="status-label">{online ? 'Online' : 'Offline'}</p>
              {!online && status?.lastSeenAt ? (
                <p className="last-seen">
                  Última conexão: {formatLastSeen(status.lastSeenAt)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <p className="subtitle">
          Controle a liberação da ração agora ou programe o próximo horário.
        </p>

        {loading ? <p className="info-text">Carregando status...</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
        {message ? <p className="feedback success">{message}</p> : null}

        <div className="actions">
          <button
            className="primary-button"
            type="button"
            onClick={handleRelease}
            disabled={releasing}
          >
            {releasing ? 'Liberando...' : 'Liberar ração'}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowScheduler((current) => !current)}
          >
            {showScheduler ? 'Fechar agendamento' : 'Agendar'}
          </button>
        </div>

        {showScheduler ? (
          <form className="scheduler" onSubmit={handleSchedule}>
            <label>
              Dia
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>

            <label>
              hh:mm
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required
              />
            </label>

            <button
              className="primary-button"
              type="submit"
              disabled={scheduling || !date || !time}
            >
              {scheduling ? 'Agendando...' : 'Agendar'}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  )
}
