import type {
  DataSource,
  Robot,
  RobotDimensions,
  RobotModel,
} from '../../../shared/contracts/robots.ts'

export type {
  DataSource,
  Robot,
  RobotModel,
} from '../../../shared/contracts/robots.ts'

// Compatibilidad temporal para los componentes existentes.
// Los nuevos consumidores deben importar desde api/client.
export {
  fetchJson,
  errorMessage,
} from '../api/client.ts'

// Las etiquetas pertenecen a la interfaz; los valores válidos están en el contrato.
export const DATA_SOURCES = {
  simulated: 'Simulado para la demo',
  documented: 'Documentación técnica',
  measured: 'Medición',
  unknown: 'Sin verificar',
} as const satisfies Record<DataSource, string>

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

// Comprueba los campos comunes de las respuestas de modelos y unidades.
// Los tipos TypeScript solos no validan los datos recibidos por HTTP.
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

// Estas comprobaciones permiten usar la respuesta solo si respeta el contrato.
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
export function requiredWidth(
  profile: RobotDimensions,
): number | null {
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