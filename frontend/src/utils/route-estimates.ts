export type RobotOperatingProfile = {
  speedKmh: number
  batteryCapacityWh: number
  consumptionWhPerKm: number
}

export type RouteEstimates = {
  durationSeconds: number
  consumptionWh: number
  requiredCapacityPercent: number
}

export function isRobotOperatingProfile(
  value: unknown,
): value is RobotOperatingProfile {
  if (!value || typeof value !== 'object') return false

  const robot = value as Record<string, unknown>

  return [
    robot.speedKmh,
    robot.batteryCapacityWh,
    robot.consumptionWhPerKm,
  ].every(
    (item) =>
      typeof item === 'number' &&
      Number.isFinite(item) &&
      item > 0,
  )
}

export function calculateRouteEstimates(
  distanceMeters: number,
  robot: RobotOperatingProfile,
): RouteEstimates | null {
  if (
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0 ||
    !isRobotOperatingProfile(robot)
  ) {
    return null
  }

  const distanceKm = distanceMeters / 1000

  const durationSeconds =
    (distanceKm / robot.speedKmh) * 3600

  const consumptionWh =
    distanceKm * robot.consumptionWhPerKm

  const requiredCapacityPercent =
    (consumptionWh / robot.batteryCapacityWh) * 100

  const estimates = {
    durationSeconds,
    consumptionWh,
    requiredCapacityPercent,
  }

  return Object.values(estimates).every(Number.isFinite)
    ? estimates
    : null
}