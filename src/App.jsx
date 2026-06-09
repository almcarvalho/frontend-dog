import { useEffect, useMemo, useState } from 'react'

const RAW_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://backend-dog-9e63.onrender.com'
const STATUS_POLL_INTERVAL = 3000
const API_KEY_COOKIE_NAME = 'dogfront_api_key'
const MACHINE_COOKIE_NAME = 'dogfront_machine'
const MACHINE_HISTORY_COOKIE_NAME = 'dogfront_machine_history'
const MACHINE_QUANTITY_COOKIE_NAME = 'dogfront_machine_quantity_map'
const DEFAULT_TEMPO_MS = 1500

function readCookie(name) {
  if (typeof document === 'undefined') {
    return ''
  }

  const prefix = `${name}=`
  const match = document.cookie
    .split('; ')
    .find((cookieEntry) => cookieEntry.startsWith(prefix))

  return match ? decodeURIComponent(match.slice(prefix.length)) : ''
}

function writeCookie(name, value, maxAgeDays = 365) {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeDays * 24 * 60 * 60}; samesite=lax`
}

function getMachineFromQuery() {
  const params = new URLSearchParams(window.location.search)
  return params.get('maquina') || ''
}

function getInitialMachine() {
  if (typeof window === 'undefined') {
    return 'dog1'
  }

  return getMachineFromQuery() || readCookie(MACHINE_COOKIE_NAME) || 'dog1'
}

function getMachineHistory() {
  const storedHistory = readCookie(MACHINE_HISTORY_COOKIE_NAME)
  if (!storedHistory) {
    return []
  }

  try {
    const parsedHistory = JSON.parse(storedHistory)
    return Array.isArray(parsedHistory)
      ? parsedHistory.filter((item) => typeof item === 'string' && item.trim())
      : []
  } catch {
    return []
  }
}

function getInitialApiKey() {
  return readCookie(API_KEY_COOKIE_NAME)
}

function saveMachineHistory(history) {
  writeCookie(MACHINE_HISTORY_COOKIE_NAME, JSON.stringify(history))
}

function getMachineQuantityMap() {
  const storedMap = readCookie(MACHINE_QUANTITY_COOKIE_NAME)
  if (!storedMap) {
    return {}
  }

  try {
    const parsedMap = JSON.parse(storedMap)
    return parsedMap && typeof parsedMap === 'object' ? parsedMap : {}
  } catch {
    return {}
  }
}

function saveMachineQuantityMap(quantityMap) {
  writeCookie(MACHINE_QUANTITY_COOKIE_NAME, JSON.stringify(quantityMap))
}

function hasSavedQuantityForMachine(machineName) {
  const normalizedMachine = machineName.trim()
  if (!normalizedMachine) {
    return false
  }

  const quantityMap = getMachineQuantityMap()
  return Number.isFinite(Number(quantityMap[normalizedMachine]))
}

function getQuantityForMachine(machineName) {
  const normalizedMachine = machineName.trim()
  if (!normalizedMachine) {
    return String(DEFAULT_TEMPO_MS / 1000)
  }

  const quantityMap = getMachineQuantityMap()
  const storedValue = quantityMap[normalizedMachine]
  return storedValue ? String(storedValue / 1000) : String(DEFAULT_TEMPO_MS / 1000)
}

function buildNextHistory(currentMachine, history) {
  const normalizedMachine = currentMachine.trim()
  if (!normalizedMachine) {
    return history
  }

  return [normalizedMachine, ...history.filter((item) => item !== normalizedMachine)].slice(
    0,
    8,
  )
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

function getHeaders(apiKey, includeJson = false) {
  const headers = {}

  if (includeJson) {
    headers['Content-Type'] = 'application/json'
  }

  if (apiKey) {
    headers['x-api-key'] = apiKey
  }

  return headers
}

function formatReleaseDate(value) {
  if (!value) {
    return ''
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(parsedDate)
}

function formatTempoMs(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return ''
  }

  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: numericValue % 1000 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(numericValue / 1000)} segundos`
}

function formatRepeatValue(value) {
  if (!value) {
    return ''
  }

  const normalizedValue = String(value).trim().toLowerCase()
  if (['nao', 'não', 'false', '0'].includes(normalizedValue)) {
    return 'Não'
  }

  if (['sim', 'true', '1'].includes(normalizedValue)) {
    return 'Sim'
  }

  return value
}

function transformApiMessage(rawMessage) {
  if (!rawMessage) {
    return rawMessage
  }

  const normalizedMessage = rawMessage.replace(/\r/g, '')
  const machineMatch = normalizedMessage.match(/Racao dispensada para\s+(.+?)\./i)
  const originMatch = normalizedMessage.match(/Origem:\s*(.+?)\./i)
  const localTimeMatch = normalizedMessage.match(/Hora do disparo:\s*([^\n.]+)(?:\.\s*|$)/i)
  const tempoMatch = normalizedMessage.match(/Tempo escolhido:\s*(\d+)\s*ms\.?/i)
  const repeatMatch = normalizedMessage.match(
    /Novo agendamento no mesmo horario:\s*([^\n.]+)(?:\.\s*|$)/i,
  )

  if (!machineMatch && !originMatch && !localTimeMatch && !tempoMatch && !repeatMatch) {
    return rawMessage
  }

  const nextLines = []

  if (machineMatch) {
    nextLines.push(`Racao dispensada para ${machineMatch[1]}.`)
  }

  if (originMatch) {
    nextLines.push(`Origem: ${originMatch[1]}.`)
  }

  if (localTimeMatch) {
    nextLines.push(`Hora da liberacao: ${formatReleaseDate(localTimeMatch[1])}`)
  }

  if (tempoMatch) {
    nextLines.push(`Tempo escolhido: ${formatTempoMs(tempoMatch[1])}`)
  }

  if (repeatMatch) {
    nextLines.push(
      `Novo agendamento no mesmo horario: ${formatRepeatValue(repeatMatch[1])}.`,
    )
  }

  return nextLines.join('\n')
}

async function readResponseMessage(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const data = await response.json()
    return transformApiMessage(data?.mensagem || data?.message || fallbackMessage)
  }

  const responseText = await response.text()
  return transformApiMessage(responseText || fallbackMessage)
}

function normalizeSchedules(payload) {
  const rawSchedules = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.agendamentos)
      ? payload.agendamentos
      : Array.isArray(payload?.items)
        ? payload.items
        : []

  const seenKeys = new Set()

  return rawSchedules.filter((schedule) => {
    const scheduleId = schedule?.id || schedule?._id || schedule?.uuid
    const dateValue = schedule?.data || schedule?.date || ''
    const timeValue = schedule?.hora || schedule?.time || ''
    const dateTimeValue =
      schedule?.scheduledReleaseAt ||
      schedule?.agendadoPara ||
      schedule?.scheduledAt ||
      schedule?.datetime ||
      ''
    const machineValue = schedule?.machine || ''

    const dedupeKey =
      scheduleId ||
      `${machineValue}|${dateValue}|${timeValue}|${dateTimeValue}|${Boolean(schedule?.repeat)}`

    if (seenKeys.has(dedupeKey)) {
      return false
    }

    seenKeys.add(dedupeKey)
    return true
  })
}

function formatScheduleDate(schedule) {
  const dateValue = schedule?.data || schedule?.date
  const timeValue = schedule?.hora || schedule?.time

  if (dateValue && timeValue) {
    const parsedDate = new Date(`${dateValue}T${timeValue}`)
    if (!Number.isNaN(parsedDate.getTime())) {
      const shortDate = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }).format(parsedDate)
      const weekday = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
      }).format(parsedDate)
      const formattedTime = timeValue.replace(':', 'h')

      return `${shortDate} ${weekday} às ${formattedTime}`
    }

    return `${dateValue} ${timeValue}`
  }

  const dateTimeValue =
    schedule?.scheduledReleaseAt ||
    schedule?.agendadoPara ||
    schedule?.scheduledAt ||
    schedule?.datetime

  if (!dateTimeValue) {
    return 'Horario indisponivel'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(dateTimeValue))
    .replace(',', '')
    .replace(/^(\d{2}\/\d{2})\s/, '$1 ')
    .replace(/(\d{2}):(\d{2})$/, '$1h$2')
}

function formatScheduleRepeat(schedule) {
  return schedule?.repeat ? 'Repete no dia seguinte: sim.' : 'Repete no dia seguinte: não.'
}

function getScheduleId(schedule, index) {
  return schedule?.id || schedule?._id || schedule?.uuid || `${schedule?.data || 'item'}-${index}`
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => getInitialApiKey())
  const [savedApiKey, setSavedApiKey] = useState(() => getInitialApiKey())
  const [showAccessField, setShowAccessField] = useState(() => !getInitialApiKey())
  const [machine, setMachine] = useState(() => getInitialMachine())
  const [savedMachine, setSavedMachine] = useState(() => getInitialMachine())
  const [showMachineField, setShowMachineField] = useState(() => !getInitialMachine())
  const [defaultQuantity, setDefaultQuantity] = useState(() =>
    getQuantityForMachine(getInitialMachine()),
  )
  const [showQuantityField, setShowQuantityField] = useState(() => {
    const initialMachine = getInitialMachine()
    return !initialMachine || !hasSavedQuantityForMachine(initialMachine)
  })
  const [machineHistory, setMachineHistory] = useState(() => getMachineHistory())
  const [status, setStatus] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [releasing, setReleasing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [cancelingScheduleId, setCancelingScheduleId] = useState('')
  const [showScheduler, setShowScheduler] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('')
  const [repeat, setRepeat] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)

  const normalizedMachine = machine.trim()
  const activeMachine = savedMachine.trim()
  const normalizedApiKey = apiKey.trim()
  const quantitySeconds = Number(defaultQuantity)
  const quantityMs =
    Number.isFinite(quantitySeconds) && quantitySeconds > 0
      ? Math.round(quantitySeconds * 1000)
      : DEFAULT_TEMPO_MS
  const machineSuggestions = useMemo(
    () =>
      machineHistory.filter(
        (historyMachine) =>
          historyMachine !== normalizedMachine &&
          historyMachine.toLowerCase().includes(normalizedMachine.toLowerCase()),
      ),
    [machineHistory, normalizedMachine],
  )

  useEffect(() => {
    if (savedApiKey.trim()) {
      setShowAccessField(false)
    }
  }, [savedApiKey])

  useEffect(() => {
    if (activeMachine) {
      setShowMachineField(false)
    }
  }, [activeMachine])

  useEffect(() => {
    setDefaultQuantity(getQuantityForMachine(activeMachine))
    if (activeMachine && hasSavedQuantityForMachine(activeMachine)) {
      setShowQuantityField(false)
    }
  }, [activeMachine])

  async function fetchStatus(showLoader = false) {
    if (!activeMachine) {
      setStatus(null)
      setLoading(false)
      return
    }

    if (showLoader) {
      setLoading(true)
    }

    try {
      const response = await fetch(buildUrl('/status', { machine: activeMachine }))
      if (!response.ok) {
        throw new Error('Falha ao consultar o status da maquina.')
      }

      const data = await response.json()
      setStatus(data)
      setError('')
    } catch (err) {
      setError(err.message || 'Nao foi possivel conectar ao servidor.')
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }

  async function fetchSchedules() {
    if (!activeMachine) {
      setSchedules([])
      return
    }

    setScheduleLoading(true)

    try {
      const response = await fetch(buildUrl('/agendamentos', { machine: activeMachine }))
      if (!response.ok) {
        throw new Error('Falha ao buscar os agendamentos da maquina.')
      }

      const data = await response.json()
      setSchedules(normalizeSchedules(data))
      setError('')
    } catch (err) {
      setSchedules([])
      setError(err.message || 'Nao foi possivel carregar os agendamentos.')
    } finally {
      setScheduleLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus(true)
    fetchSchedules()

    if (!activeMachine) {
      return undefined
    }

    const interval = setInterval(() => {
      fetchStatus(false)
    }, STATUS_POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [activeMachine])

  useEffect(() => {
    if (showScheduler) {
      fetchSchedules()
    }
  }, [showScheduler, normalizedMachine])

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
    if (!normalizedMachine) {
      setError('Informe o nome da maquina antes de liberar a racao.')
      return
    }

    if (!normalizedApiKey) {
      setError('Informe a senha antes de liberar a racao.')
      return
    }

    const confirmed = window.confirm('Deseja mesmo liberar agora a racao?')
    if (!confirmed) {
      return
    }

    setReleasing(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(buildUrl('/liberar-racao', {}), {
        method: 'POST',
        headers: getHeaders(normalizedApiKey, true),
        body: JSON.stringify({
          machine: activeMachine,
          tempoMs: quantityMs,
        }),
      })

      if (!response.ok) {
        throw new Error('Nao foi possivel solicitar a liberacao da racao.')
      }

      const nextMessage = await readResponseMessage(
        response,
        'Liberacao solicitada com sucesso.',
      )
      setMessage(nextMessage)
      await fetchStatus(false)
    } catch (err) {
      setError(err.message || 'Falha ao liberar a racao.')
    } finally {
      setReleasing(false)
    }
  }

  async function handleSchedule(event) {
    event.preventDefault()

    if (!activeMachine) {
      setError('Informe o nome da maquina antes de criar um agendamento.')
      return
    }

    if (!normalizedApiKey) {
      setError('Informe a senha antes de criar um agendamento.')
      return
    }

    setScheduling(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(buildUrl('/agendar-racao', {}), {
        method: 'POST',
        headers: getHeaders(normalizedApiKey, true),
        body: JSON.stringify({
          machine: activeMachine,
          data: date,
          hora: time,
          tempoMs: quantityMs,
          repeat,
        }),
      })

      if (!response.ok) {
        throw new Error('Nao foi possivel agendar a liberacao.')
      }

      const nextMessage = await readResponseMessage(
        response,
        'Liberacao agendada com sucesso.',
      )
      setMessage(nextMessage)
      await Promise.all([fetchStatus(false), fetchSchedules()])
    } catch (err) {
      setError(err.message || 'Falha ao agendar a racao.')
    } finally {
      setScheduling(false)
    }
  }

  async function handleCancelSchedule(schedule) {
    const scheduleId = schedule?.id || schedule?._id || schedule?.uuid
    if (!scheduleId) {
      setError('Nao foi possivel identificar o agendamento selecionado.')
      return
    }

    if (!activeMachine) {
      setError('Informe o nome da maquina antes de cancelar um agendamento.')
      return
    }

    if (!normalizedApiKey) {
      setError('Informe a senha antes de cancelar um agendamento.')
      return
    }

    setCancelingScheduleId(String(scheduleId))
    setError('')
    setMessage('')

    try {
      const response = await fetch(
        buildUrl('/agendamentos', { machine: activeMachine, id: scheduleId }),
        {
          method: 'DELETE',
          headers: getHeaders(normalizedApiKey),
        },
      )

      if (!response.ok) {
        throw new Error('Nao foi possivel cancelar o agendamento.')
      }

      const nextMessage = await readResponseMessage(
        response,
        'Agendamento cancelado com sucesso.',
      )
      setMessage(nextMessage)
      await Promise.all([fetchStatus(false), fetchSchedules()])
    } catch (err) {
      setError(err.message || 'Falha ao cancelar o agendamento.')
    } finally {
      setCancelingScheduleId('')
    }
  }

  function persistMachine() {
    if (!normalizedMachine) {
      return
    }

    if (normalizedMachine === savedMachine) {
      setShowMachineField(false)
      return
    }

    writeCookie(MACHINE_COOKIE_NAME, normalizedMachine)
    const nextHistory = buildNextHistory(normalizedMachine, machineHistory)
    setSavedMachine(normalizedMachine)
    setMachineHistory(nextHistory)
    saveMachineHistory(nextHistory)
    setShowMachineField(false)
  }

  function persistAccess() {
    const normalizedAccess = apiKey.trim()
    if (!normalizedAccess) {
      return
    }

    if (normalizedAccess === savedApiKey.trim()) {
      setShowAccessField(false)
      return
    }

    writeCookie(API_KEY_COOKIE_NAME, normalizedAccess)
    setApiKey(normalizedAccess)
    setSavedApiKey(normalizedAccess)
    setShowAccessField(false)
  }

  function persistDefaultQuantity() {
    if (!activeMachine) {
      return
    }

    const parsedQuantitySeconds = Number(defaultQuantity)
    const safeQuantityMs =
      Number.isFinite(parsedQuantitySeconds) && parsedQuantitySeconds > 0
        ? Math.round(parsedQuantitySeconds * 1000)
        : DEFAULT_TEMPO_MS

    const quantityMap = getMachineQuantityMap()
    quantityMap[activeMachine] = safeQuantityMs
    saveMachineQuantityMap(quantityMap)
    setDefaultQuantity(String(safeQuantityMs / 1000))
    setShowQuantityField(false)
  }

  function handleMachineSuggestionClick(nextMachine) {
    setMachine(nextMachine)
    setSavedMachine(nextMachine)
    writeCookie(MACHINE_COOKIE_NAME, nextMachine)
    const nextHistory = buildNextHistory(nextMachine, machineHistory)
    setMachineHistory(nextHistory)
    saveMachineHistory(nextHistory)
    setDefaultQuantity(getQuantityForMachine(nextMachine))
    setShowMachineField(false)
  }

  function handleMachineSuggestionRemove(machineToRemove) {
    const nextHistory = machineHistory.filter((item) => item !== machineToRemove)
    setMachineHistory(nextHistory)
    saveMachineHistory(nextHistory)
  }

  const online = Boolean(status?.online)
  const nextReleaseText =
    countdown ||
    status?.tempoRestanteParaProximaLiberacao ||
    (status?.hasScheduledRelease ? 'agendada' : null)

  return (
    <main className="app-shell">
      <section className="panel">
        <div className="machine-header">
          {showAccessField ? (
            <label className="machine-field">
              <span>Acesso</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                onBlur={persistAccess}
                placeholder="Digite o acesso da API"
                autoComplete="off"
              />
            </label>
          ) : null}

          {showMachineField ? (
            <label className="machine-field">
              <span>Maquina</span>
              <input
                type="text"
                value={machine}
                onChange={(event) => setMachine(event.target.value)}
                onBlur={persistMachine}
                placeholder="Ex.: dog1"
                autoComplete="off"
              />
            </label>
          ) : null}

          {showQuantityField ? (
            <label className="machine-field">
              <span>Tempo de acionamento</span>
              <input
                type="number"
                min="1"
                step="0.1"
                value={defaultQuantity}
                onChange={(event) => setDefaultQuantity(event.target.value)}
                onBlur={persistDefaultQuantity}
                placeholder="Em segundos"
                autoComplete="off"
                disabled={!activeMachine}
              />
            </label>
          ) : null}

          {machineSuggestions.length ? (
            <div className="machine-suggestions" aria-label="Historico de maquinas">
              {machineSuggestions.map((historyMachine) => (
                <div className="machine-suggestion-item" key={historyMachine}>
                  <button
                    className="machine-suggestion-button"
                    type="button"
                    onClick={() => handleMachineSuggestionClick(historyMachine)}
                  >
                    {historyMachine}
                  </button>
                  <button
                    className="machine-remove-button"
                    type="button"
                    aria-label={`Remover ${historyMachine} do historico`}
                    onClick={() => handleMachineSuggestionRemove(historyMachine)}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="title-row">
          <div>
            <div className="brand-row">
              <h1>Doguinho App</h1>
            </div>
            {nextReleaseText ? (
              <p className="next-release">
                Proxima liberacao em <strong>{nextReleaseText}</strong>
              </p>
            ) : null}
          </div>
          <div className="status-box" aria-live="polite">
            <span className={`status-dot ${online ? 'online' : 'offline'}`} />
            <div>
              <p className="status-label">
                {online ? 'Online' : 'Offline'}
                {activeMachine ? ` - ${activeMachine}` : ''}
              </p>
              {!online && status?.lastSeenAt ? (
                <p className="last-seen">
                  Ultima conexao: {formatLastSeen(status.lastSeenAt)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <p className="subtitle">
          Um projeto open source para dispensar racao para animais desenvolvido por
          Lucas Carvalho @br.lcsistemas.
        </p>

        <img className="dog-hero-icon" src="/icondog.png" alt="" aria-hidden="true" />

        {loading ? <p className="info-text">Carregando status...</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
        {message ? <p className="feedback success">{message}</p> : null}

        <div className="actions">
          <button
            className="primary-button"
            type="button"
            onClick={handleRelease}
            disabled={releasing || !activeMachine || !normalizedApiKey}
          >
            {releasing ? 'Liberando...' : 'Liberar racao'}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setShowScheduler((current) => !current)
              setShowSettingsMenu(false)
            }}
            disabled={!activeMachine}
          >
            {showScheduler ? 'Fechar agendamento' : 'Agendar'}
          </button>

          <div className="settings-menu-wrapper">
            <button
              className="icon-button"
              type="button"
              aria-label="Configuracoes"
              onClick={() => setShowSettingsMenu((current) => !current)}
            >
              ...
            </button>

            {showSettingsMenu ? (
              <div className="settings-menu">
                <button
                  className="settings-menu-item"
                  type="button"
                  onClick={() => {
                    setShowAccessField(true)
                    setShowSettingsMenu(false)
                  }}
                >
                  Alterar acesso
                </button>
                <button
                  className="settings-menu-item"
                  type="button"
                  onClick={() => {
                    setShowMachineField(true)
                    setShowSettingsMenu(false)
                  }}
                >
                  Alterar maquina
                </button>
                <button
                  className="settings-menu-item"
                  type="button"
                  onClick={() => {
                    setShowQuantityField(true)
                    setShowSettingsMenu(false)
                  }}
                >
                  Alterar tempo de acionamento
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {showScheduler ? (
          <>
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

              <label className="repeat-field" title="Repetir horario para dispensar no dia seguinte nessa mesma hora">
                <span>Repetir prox dia</span>
                <div className="repeat-control">
                  <input
                    type="checkbox"
                    checked={repeat}
                    onChange={(event) => setRepeat(event.target.checked)}
                  />
                  <span className="tooltip-hint" aria-hidden="true">
                    ?
                  </span>
                </div>
              </label>

              <button
                className="primary-button"
                type="submit"
                disabled={scheduling || !date || !time || !activeMachine}
              >
                {scheduling ? 'Agendando...' : 'Agendar'}
              </button>
            </form>

            <section className="schedule-list">
              <div className="schedule-list-header">
                <h2>Agendamentos da maquina</h2>
                {scheduleLoading ? <span>Atualizando...</span> : null}
              </div>

              {schedules.length ? (
                <div className="schedule-items">
                  {schedules.map((schedule, index) => (
                    <article className="schedule-card" key={getScheduleId(schedule, index)}>
                      <div className="schedule-card-top">
                        <div>
                      <p className="schedule-machine">{schedule.machine || activeMachine}</p>
                          <p className="schedule-when">{formatScheduleDate(schedule)}</p>
                          <p className="schedule-meta">{formatScheduleRepeat(schedule)}</p>
                        </div>
                        <button
                          className="danger-button"
                          type="button"
                          disabled={
                            cancelingScheduleId ===
                            String(schedule?.id || schedule?._id || schedule?.uuid || '')
                          }
                          onClick={() => handleCancelSchedule(schedule)}
                        >
                          {cancelingScheduleId ===
                          String(schedule?.id || schedule?._id || schedule?.uuid || '')
                            ? 'Cancelando...'
                            : 'Cancelar'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="info-text">Nenhum agendamento ativo para essa maquina.</p>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}
