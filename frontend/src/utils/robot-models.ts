export const DATA_SOURCES = {
  simulated: 'Simulado para la demo',
  documented: 'Documentación técnica',
  measured: 'Medición',
  unknown: 'Sin verificar',
} as const

export type DataSource = keyof typeof DATA_SOURCES

type OperatingProfile = {
  speedKmh: number
  batteryCapacityWh: number
  consumptionWhPerKm: number
  maxSlopePercent: number | null
}

type Dimensions = {
  widthMeters: number | null
  lengthMeters: number | null
  lateralMarginMeters: number | null
}

export type RobotModel = OperatingProfile & Dimensions & {
  id: string
  name: string
  dataSource: DataSource
  sourceNotes: string | null
  createdAt: string
}

export type Robot = OperatingProfile & Dimensions & {
  id: string
  name: string
  model: string | null
  modelId: string | null
  dataSource: DataSource | null
  sourceNotes: string | null
  createdAt: string
}

function positive(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
  )
}

function nonnegative(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
  )
}

function nullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isDataSource(value: unknown): value is DataSource {
  return (
    typeof value === 'string'
    && Object.hasOwn(DATA_SOURCES, value)
  )
}

function profile(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.createdAt === 'string'
    && positive(value.speedKmh)
    && positive(value.batteryCapacityWh)
    && positive(value.consumptionWhPerKm)
    && (
      value.maxSlopePercent === null
      || nonnegative(value.maxSlopePercent)
    )
    && (
      value.widthMeters === null
      || positive(value.widthMeters)
    )
    && (
      value.lengthMeters === null
      || positive(value.lengthMeters)
    )
    && (
      value.lateralMarginMeters === null
      || nonnegative(value.lateralMarginMeters)
    )
    && nullableText(value.sourceNotes)
  )
}

export function isRobotModel(value: unknown): value is RobotModel {
  if (!value || typeof value !== 'object') return false

  const item = value as Record<string, unknown>

  return profile(item) && isDataSource(item.dataSource)
}

export function isRobot(value: unknown): value is Robot {
  if (!value || typeof value !== 'object') return false

  const item = value as Record<string, unknown>

  return (
    profile(item)
    && nullableText(item.model)
    && nullableText(item.modelId)
    && (
      item.dataSource === null
      || isDataSource(item.dataSource)
    )
  )
}

// Referencia geométrica; no certifica un paso
// ni contempla todavía las maniobras.
export function requiredWidth(profile: Dimensions): number | null {
  if (
    !positive(profile.widthMeters)
    || !nonnegative(profile.lateralMarginMeters)
  ) {
    return null
  }

  const width =
    profile.widthMeters + 2 * profile.lateralMarginMeters

  return Number.isFinite(width) ? width : null
}

export async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: init.signal
      ? AbortSignal.any([
          init.signal,
          AbortSignal.timeout(40000),
        ])
      : AbortSignal.timeout(40000),
  })

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      body
      && typeof body === 'object'
      && 'message' in body
      && typeof body.message === 'string'
        ? body.message
        : 'No se pudo completar la operación.'

    throw new Error(message)
  }

  return body
}

export function errorMessage(error: unknown): string {
  if (
    error instanceof Error
    && error.name === 'TimeoutError'
  ) {
    return 'La consulta tardó demasiado. Intentá nuevamente.'
  }

  if (error instanceof TypeError) {
    return 'No se pudo conectar con el backend.'
  }

  return error instanceof Error
    ? error.message
    : 'Ocurrió un error inesperado.'
}