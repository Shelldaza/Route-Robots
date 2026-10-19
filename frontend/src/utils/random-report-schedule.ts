export function nextReportAt(
  nowMs: number,
  sample = Math.random(),
): number {
  if (
    !Number.isFinite(nowMs)
    || !Number.isFinite(sample)
    || sample < 0
    || sample > 1
  ) {
    throw new Error(
      'No se pudo programar el próximo reporte.',
    )
  }

  return (
    nowMs
    + 120_000
    + Math.min(
      60_000,
      Math.floor(sample * 60_001),
    )
  )
}