// Fachada de compatibilidad para los imports existentes.
// Los datos y el dibujo viven en módulos independientes.

export {
  fetchPedestrianNetwork,
} from '../features/pedestrian/network-api';

export {
  drawPedestrianNetwork,
  segmentLabels,
} from '../features/pedestrian/network-layer';

export {
  isPedestrianImpact,
} from './pedestrian-validation';

export type {
  PedestrianSegment,
  PedestrianNetwork,
  PedestrianImpact,
} from '../../../shared/contracts/pedestrian';
