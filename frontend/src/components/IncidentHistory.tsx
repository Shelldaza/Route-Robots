import type {
  IncidentSummaryDTO as Incident,
} from '../../../shared/contracts/incidents'

import {
  INCIDENT_LABELS,
  EFFECT_LABELS,
  STATUS_LABELS,
  getIncidentStatus,
  formatDate,
} from '../features/incidents/incident-rules'

// Presentación del historial: recibe datos y una fecha del escenario.
export default function IncidentHistory({
  incidents,
  nowMs,
}: {
  incidents: Incident[]
  nowMs: number
}) {
  return (
    <details>
      <summary>
        Historial de incidentes ({incidents.length})
      </summary>

      {incidents.map((incident) => (
        <div
          className="simulation-incident-result"
          key={incident.id}
        >
          <strong>
            {INCIDENT_LABELS[incident.type]}
            {' · '}
            {STATUS_LABELS[
              getIncidentStatus(incident, nowMs)
            ]}
          </strong>

          <p>{incident.description}</p>

          <p>
            {incident.placementKind === 'surface'
              ? `Efecto: ${EFFECT_LABELS[incident.effect]}. Área delimitada sobre la superficie cartográfica.`
              : `Efecto: ${EFFECT_LABELS[incident.effect]}. Alcance: ${incident.placementKind === 'segment' ? 'Tramos completos' : 'Área de prueba'}.`}
          </p>

          <p>
            Informante:{' '}
            {incident.reporterName ?? 'Sin identificar'}
          </p>

          <p>
            Inicio: {formatDate(incident.startsAt)}
            {' · '}
            Fin: {formatDate(incident.expiresAt)}
          </p>
        </div>
      ))}
    </details>
  )
}
