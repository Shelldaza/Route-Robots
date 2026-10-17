import blockageIcon from '../assets/incidents/blockage.png'
import temporaryObstacleIcon from '../assets/incidents/temporary-obstacle.png'
import temporaryClosureIcon from '../assets/incidents/temporary-closure.png'
import roadworksIcon from '../assets/incidents/roadworks.png'
import standingWaterIcon from '../assets/incidents/standing-water.png'
import crowdIcon from '../assets/incidents/crowd.png'
import obstructingVehicleIcon from '../assets/incidents/obstructing-vehicle.png'
import scheduledEventIcon from '../assets/incidents/scheduled-event.png'
import potholeIcon from '../assets/incidents/pothole.png'
import unevenSurfaceIcon from '../assets/incidents/uneven-surface.png'

type IncidentAppearance = {
  label: string
  iconUrl: string
}

const fallbackAppearance: IncidentAppearance = {
  label: 'Bloqueo',
  iconUrl: blockageIcon,
}

const appearances: Record<string, IncidentAppearance> = {
  blockage: fallbackAppearance,
  temporary_obstacle: {
    label: 'Obstáculo temporal',
    iconUrl: temporaryObstacleIcon,
  },
  temporary_closure: {
    label: 'Cierre temporal',
    iconUrl: temporaryClosureIcon,
  },
  roadworks: {
    label: 'Obras',
    iconUrl: roadworksIcon,
  },
  standing_water: {
    label: 'Acumulación de agua',
    iconUrl: standingWaterIcon,
  },
  crowd: {
    label: 'Aglomeración de personas',
    iconUrl: crowdIcon,
  },
  obstructing_vehicle: {
    label: 'Vehículo obstruyendo el paso',
    iconUrl: obstructingVehicleIcon,
  },
  scheduled_event: {
    label: 'Evento programado',
    iconUrl: scheduledEventIcon,
  },
  pothole: {
    label: 'Bache',
    iconUrl: potholeIcon,
  },
  uneven_surface: {
    label: 'Superficie irregular',
    iconUrl: unevenSurfaceIcon,
  },
}

export function getIncidentAppearance(
  type: string,
): IncidentAppearance {
  // Conserva una representación para registros antiguos o tipos
  // que el backend incorpore antes de actualizar el frontend.
  return Object.prototype.hasOwnProperty.call(appearances, type)
    ? appearances[type]!
    : fallbackAppearance
}