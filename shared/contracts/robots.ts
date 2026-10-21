// Datos que la API intercambia con el frontend.
// Este archivo no depende de React, Express ni de PostgreSQL.

export type DataSource =
  | 'simulated'
  | 'documented'
  | 'measured'
  | 'unknown'

// Capacidades operativas que provienen del modelo del robot.
export type RobotOperatingData = {
  speedKmh: number
  batteryCapacityWh: number
  consumptionWhPerKm: number
  maxSlopePercent: number | null
}

// null significa que no conocemos esa medida; no equivale a cero.
export type RobotDimensions = {
  widthMeters: number | null
  lengthMeters: number | null
  lateralMarginMeters: number | null
}

// Contratos JSON: createdAt llega por HTTP como texto.
export type RobotModel = RobotOperatingData & RobotDimensions & {
  id: string
  name: string
  dataSource: DataSource
  sourceNotes: string | null
  createdAt: string
}

export type Robot = RobotOperatingData & RobotDimensions & {
  id: string
  name: string
  model: string | null
  modelId: string | null
  dataSource: DataSource | null
  sourceNotes: string | null
  createdAt: string
}