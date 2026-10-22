// Coordenadas GeoJSON: [longitud, latitud].
export type Coordinate = [number, number]

// Formato utilizado por las solicitudes HTTP de rutas.
export type GeographicPoint = {
  lat: number
  lng: number
}

// Límites geográficos; no representan un polígono arbitrario.
export type Bounds = {
  south: number
  west: number
  north: number
  east: number
}

// Nombre semántico para los límites de un bloqueo rectangular.
export type BlockedArea = Bounds