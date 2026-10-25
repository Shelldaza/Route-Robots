# Auditoría Técnica - RouteRobots
  
**Responsable:** Facundo Daza

**Fecha de inicio:** 21/10/2026

**Fecha estimada de finalización:** 03/11/2026

## 1. Introducción

### 1.1. Contexto

El proyecto ha demostrado un funcionamiento correcto durante las distintas pruebas y verificaciones(manuales y automaticas) realizadas a lo largo del desarrollo. Sin embargo, reconozco que durante el desarrollo cometí errores en la trazabilidad de las decisiones técnicas y en el registro de las verificaciones manuales.

Esto se refiere a más que nada para la parte sobre la IA y las decisiones, mientras que las issues y demás con sus criterios de aprobación si estan presente mediante la función projects de Github.

Durante el desarrollo inicial prioricé la implementación funcional y el despliegue. Al ser el único integrante del proyecto, la carga de trabajo fue considerable y no mantuve un registro sistemático de la IA.

Por este motivo, decidí iniciar una auditoría técnica retrospectiva antes de continuar con el proyecto para revisar el código actual en profundidad, identificar posibles problemas, realizar las correcciones necesarias, mejorar la documentación y las prácticas de desarrollo a partir de esta etapa.

### 1.2. Objetivos

**Los objetivos principales son:**

- Comprender en profundidad y documentar la implementación actual.
- Verificar el funcionamiento correcto de sus componentes.
- Detectar errores, riesgos y problemas de mantenibilidad.
- Detectar errores, riesgos y problemas de seguridad.
- Aplicar correcciones justificadas.
- Incorporar pruebas reproducibles cuando corresponda.
- Mejorar la trazabilidad de las decisiones técnicas y del uso de IA.

### 1.3. Alcance

La auditoría comprende:

- Backend y API.
- Frontend.
- Lógica de evaluación de rutas.
- Integraciones y servicios externos.
- Seguridad y manejo de errores.
- Pruebas, CI/CD y despliegue.

## 2. Metodología

Cada componente será revisado mediante el siguiente procedimiento:

1. **Análisis:** identificar responsabilidades, dependencias y funcionamiento.
2. **Verificación:** ejecutar pruebas manuales o automatizadas.
3. **Evaluación:** identificar errores, riesgos y oportunidades de mejora.
4. **Corrección:** implementar los cambios necesarios.
5. **Documentación:** registrar resultados, decisiones y evidencias.
6. **Control de versiones:** guardar cambios mediante commits descriptivos.

Las intervenciones de inteligencia artificial se documentarán en **AI-DECISIONS.md**.

## 3. Estado inicial del sistema

### 3.1. Versión de referencia

La auditoría tomará como referencia el commit 022f0d4, correspondiente al último merge realizado en la rama main, proveniente de una rama de refactorización.

Este será el punto de partida para revisar el estado del proyecto y registrar las correcciones y mejoras realizadas durante la auditoría.

### 3.2. Funcionalidades existentes

A continuación se enumaran las siguientes funcionalidades en el código:

| Componente | Implementación existente |
|---|---|
| Robots y modelos | Registro y consulta de robots y modelos. Estas cuentan con distintas características operativas y dimensiones físicas. Ambos se almacenan en PostgreSQL |
| Planificación de rutas | Selección de origen y destino, representación del recorrido y cálculo mediante la red peatonal local o OpenRouteService|
| Simulación | Desplazamiento del robot, controles de ejecución, reloj del escenario y visualización del recorrido pendiente. |
| Métricas | Estimaciones de distancia, duración y consumo energético según los parámetros del robot. |
| Incidentes manuales | Registro por tramo peatonal o área dibujada, con tipo, efecto y período de vigencia. |
| Reportes aleatorios | Generación cada 2–3 minutos simulados y presentación de notificaciones. Actualmente generan incidentes por tramo, queda pendiente evaluar su adaptación al funcionamiento por superficies. |
| Replanificación | Detección de bloqueos y búsqueda de alternativas, incluyendo maniobras locales sobre superficies y recuperación de recorridos con retroceso cuando existe conectividad válida. |
| Integración de IA | Claude utiliza herramientas MCP para consultar incidentes y solicitar desvíos, y redacta una explicación. El cálculo y la validación geométrica pertenecen al backend. |
| Consulta de incidentes | Historial resumido, geometrías activas para el mapa y consulta del detalle de un reporte. |

Estas implementaciones constituyen el punto de partida de la auditoría.


### 3.3. Verificaciones existentes

- **Backend:** TypeScript comprueba los tipos, Vitest ejecuta las pruebas y Supertest verifica los endpoints HTTP. La persistencia y los servicios externos se simulan en las pruebas que corresponden.
- **Frontend:** Oxlint analiza el código, TypeScript y Vite comprueban tipos y compilación, **node:test** ejecuta las pruebas.
- **CI:** GitHub Actions ejecuta estas verificaciones en pull requests a **main** utilizando Node.js 24.
- **Comprobaciones operativas:** **/api/health** verifica que la API responde **npm run db:check** comprueba la conexión con PostgreSQL.

**Antecedente de ejecución:** 285 pruebas del backend y 83 del frontend aprobadas, con tipos, lint y compilación correctos.

### 3.4. Problemas y limitaciones conocidos

- **Cobertura cartográfica:** las líneas peatonales y las superficies provienen de fuentes distintas y presentan faltantes o desajustes. Se evaluará la migración hacia un enrutamiento basado en superficies y la incorporación manual de los faltantes que puedan verificarse.

- **Límites de procesamiento:** los límites de complejidad y tiempo pueden impedir verificar algunas selecciones o maniobras. Se realizarán pruebas para ajustar estos límites según los recursos disponibles.

- **Alcance de la evaluación:** actualmente se comprueban restricciones geométricas y espacio disponible. Todavía no se integran factores como pendiente, clima y batería disponible para evaluar la viabilidad completa del recorrido.

- **Dependencias externas:** las consultas de cartografía, rutas e IA dependen de servicios que pueden presentar demoras, rechazos o indisponibilidad.

- **Recursos de los planes gratuitos:** el proyecto utiliza los planes gratuitos de Render, Vercel y Neon. En Render, la carga de la red peatonal en JSON provocó un fallo por memoria. Se resolvió utilizando una representación binaria compacta del grafo. Queda pendiente medir el consumo de memoria y los tiempos al cargar superficies, acumular incidentes y calcular desvíos, y revisar los límites de uso de los tres servicios antes del despliegue final.

- **Verificación del despliegue:** queda pendiente registrar una comprobación completa del flujo entre Vercel, Render y PostgreSQL, incluyendo la respuesta ante la indisponibilidad del backend o de un servicio externo.

### 3.5. Funcionalidades pendientes

- **Simulación e interpretación de reportes:** reemplazar la creación directa de incidentes aleatorios por informes generados con IA que simulen mensajes de robots, incluyendo descripciones ambiguas, incompletas o contradictorias. La IA de RouteRobots interpretará esos mensajes y propondrá registrar un incidente, actualizar uno existente o solicitar aclaraciones. El backend validará los datos antes de modificar el mapa.

- **Plan preventivo del recorrido:** generar con IA, antes de iniciar la entrega, instrucciones basadas en la ruta, las capacidades del robot y los incidentes conocidos. El plan indicará dónde se requiere precaución, qué restricciones existen y cuándo detenerse o solicitar supervisión. Se actualizará cuando cambie la ruta o la información relevante.

- **Clasificación de transitabilidad por tramo y robot:** clasificar cada tramo según las capacidades del robot, el espacio disponible y los incidentes vigentes. Aunque el paso sea posible, ciertas condiciones pueden aumentar el tiempo de recorrido o la necesidad de intervención humana. La clasificación permitirá comparar alternativas, explicando los factores considerados y señalando cuándo falte información.

### 3.6. Estructura y funcionamiento del proyecto

RouteRobots se divide en tres partes:

- **Backend:** recibe solicitudes, consulta PostgreSQL, calcula rutas y valida incidentes.
- **Frontend:** muestra los mapas y formularios, ejecuta la simulación y solicita operaciones al backend.
- **Shared:** contiene definiciones y funciones que necesitan ambas partes.

El cálculo combina dos representaciones del espacio: **las líneas peatonales de OpenStreetMap**, que indican cómo se conectan los caminos, y **las superficies de DC GIS**, que delimitan el espacio disponible para rodear un obstáculo.

Se muestran los archivos relevantes para comprender estos procesos. Se omiten pruebas, estilos, archivos generados y módulos que únicamente reexportan funciones de otros archivos.

```text
Route-Robots/
├── backend/
│   ├── migrations/                   # Creación y modificación de tablas de PostgreSQL
│   ├── package.json                  # Dependencias y comandos para iniciar y comprobar la API
│   └── src/
│       ├── index.ts                  # Inicia el proceso y pone la API a escuchar en un puerto
│       ├── app.ts                    # Conecta las direcciones /api/... con sus archivos de rutas
│       ├── db.ts                     # Crea las conexiones reutilizables con PostgreSQL
│       │
│       ├── routes/                   # Reciben solicitudes HTTP y devuelven resultados o errores
│       │   ├── robots.ts             # Recibe solicitudes para registrar o listar robots
│       │   ├── robot-models.ts       # Recibe solicitudes para registrar o listar modelos
│       │   ├── routes.ts             # Recibe origen y destino y solicita el cálculo del recorrido
│       │   ├── pedestrian-network.ts # Devuelve los tramos de la zona solicitada por el mapa
│       │   ├── incidents.ts          # Recibe reportes y permite consultar incidentes y su catálogo
│       │   ├── surfaces.ts           # Atiende ubicación, vista previa, guardado y desvíos por superficies
│       │   └── replanning.ts         # Atiende el flujo general de solicitud de una alternativa
│       │
│       ├── schemas/                  # Comprueban campos, tipos y límites de los datos recibidos
│       │                             # Por ejemplo: coordenadas válidas y parámetros del robot
│       │
│       ├── config/
│       │   └── incident-catalog.ts   # Define tipos de incidentes, efectos y duraciones sugeridas
│       │
│       ├── services/
│       │   ├── robots.ts             # Valida el registro y distingue nombre duplicado o modelo inexistente
│       │   ├── robot-models.ts       # Valida los datos del modelo y trata los nombres duplicados
│       │   ├── incidents.ts          # Completa datos del reporte y calcula su inicio y vencimiento
│       │   ├── incident-detail.ts    # Recupera un reporte individual con sus geometrías completas
│       │   ├── incident-placement.ts # Convierte el clic en un rectángulo orientado o una selección de tramo
│       │   │
│       │   ├── routing.ts            # Usa la red local si hay una versión asociada, si no consulta OpenRouteService
│       │   ├── routing-restrictions.ts
│       │   │                         # Distingue cierres por área, tramo y superficie y valida la alternativa
│       │   ├── routing-evaluation.ts # Resume incidentes para Claude y detecta cambios durante la evaluación
│       │   │
│       │   ├── pedestrian-network.ts
│       │   │                         # Carga el archivo .bin y comprueba los IDs y la versión de los tramos
│       │   ├── pedestrian-path-proof.ts
│       │   │                         # Comprueba que el recorrido recibido siga caminos o superficies admitidos
│       │   │
│       │   ├── pedestrian-compact/   # Guarda y utiliza la red sin reconstruir el enorme JSON en memoria
│       │   │   ├── model.ts          # Define las listas de coordenadas, conexiones, distancias y textos
│       │   │   ├── compiler.ts       # Convierte los tramos originales en esas listas y sus conexiones
│       │   │   ├── codec.ts          # Convierte las listas en bytes para generar el archivo .bin
│       │   │   ├── decode.ts         # Interpreta el .bin y rechaza datos incompletos o referencias inválidas
│       │   │   ├── coordinates.ts    # Obtiene la posición de un punto y calcula distancias en metros
│       │   │   ├── strings.ts        # Guarda y recupera nombres e IDs dentro del formato compacto
│       │   │   ├── spatial.ts        # Localiza tramos por ID o busca candidatos de una zona del mapa
│       │   │   └── routing.ts        # Busca un camino entre origen y destino evitando los cierres indicados
│       │   │
│       │   ├── walk-surfaces.ts      # Valida la zona y reutiliza superficies descargadas recientemente
│       │   ├── dc-gis-provider.ts    # Descarga las áreas de veredas y cruces y comprueba su formato
│       │   ├── surface-context.ts    # Conserva el robot, la red y las medidas utilizadas en el escenario
│       │   ├── surface-incidents.ts  # Recorta el incidente a las superficies y prepara su guardado
│       │   ├── surface-evaluation.ts # Reutiliza incidentes y cartografía durante una misma evaluación
│       │   ├── surface-routing.ts    # Verifica el recorrido preferido y solicita adaptación o recuperación
│       │   ├── surface-routing-core.ts
│       │   │                         # Intenta rodear el obstáculo. si falla, busca otra ruta con restricciones
│       │   ├── surface-route-recovery.ts
│       │   │                         # Busca conexiones por caminos libres, permitiendo retroceder hasta ellas
│       │   │
│       │   ├── surface-geometry/     # Calcula por dónde cabe el robot dentro de las áreas disponibles
│       │   │   ├── constraints.ts    # Considera ancho y margen del robot para obtener el espacio libre
│       │   │   ├── polygons.ts       # Une superficies, recorta áreas y amplía o reduce sus bordes
│       │   │   ├── clipper.ts        # Convierte las áreas al formato de la biblioteca geométrica Clipper
│       │   │   ├── path.ts           # Busca una conexión continua entre dos puntos del espacio libre
│       │   │   ├── route.ts          # Sustituye la parte afectada del recorrido y conserva sus extremos
│       │   │   └── error.ts          # Diferencia un bloqueo demostrado de un paso que no pudo verificarse
│       │   │
│       │   ├── random-incidents.ts   # Consulta ocupación, solicita un reporte y guarda el resultado
│       │   └── random-incidents/     # Generación actual de incidentes estructurados, sin interpretación de IA
│       │       ├── schema.ts         # Valida simulación, fecha, versión de red y recorrido recibido
│       │       ├── determinism.ts    # Mantiene IDs de reintento y distribuye 15 de cada 100 sobre la ruta
│       │       ├── selection.ts      # Elige un tramo libre cercano, el tipo de incidente y el informante
│       │       └── spatial.ts        # Comprueba qué tramos coinciden longitudinalmente con el recorrido
│       │
│       ├── repositories/             # Ejecutan las consultas SQL de lectura y escritura
│       │   ├── robots.ts             # Consulta robots y registra unidades asociadas a un modelo
│       │   ├── robot-models.ts       # Guarda y consulta las especificaciones de los modelos
│       │   ├── incidents.ts          # Guarda reportes y filtra por simulación, fecha y efecto
│       │   ├── incident-views.ts     # Devuelve el historial sin polígonos y las geometrías de los activos
│       │   ├── surface-context.ts    # Guarda las medidas del robot asociadas a la simulación
│       │   └── surface-reports.ts    # Guarda juntos el incidente y su información de superficie
│       │
│       ├── agents/
│       │   └── replanning.ts         # Intercambia mensajes con Claude y acepta solo alternativas validadas
│       ├── mcp/
│       │   └── routing-session.ts    # Ofrece a Claude consultar_incidentes y calcular_desvio
│       ├── providers/
│       │   └── openrouteservice.ts   # Solicita rutas a ORS y trata respuestas inválidas, errores y demoras
│       ├── http/
│       │   └── request-signal.ts     # Avisa que una solicitud se interrumpió para cancelar lecturas asociadas
│       ├── types/                    # Define los registros que usan los servicios y PostgreSQL
│       │
│       ├── data/                     # Archivos de la captura peatonal original y su versión compacta
│       └── scripts/
│           ├── update-pedestrian-network.mjs
│           │                         # Descarga y prepara la captura original de caminos peatonales
│           ├── prepare-pedestrian-network.ts
│           │                         # Genera el formato compacto o descomprime el .bin para ejecutarlo
│           ├── check-db.ts           # Comprueba la conexión con PostgreSQL
│           └── check-ai.ts           # Envía una consulta breve para comprobar la conexión con Claude
│
├── frontend/
│   ├── vite.config.ts                # Configura el servidor de desarrollo y la compilación
│   ├── vercel.json                   # Reenvía /api/... desde Vercel al backend de Render
│   ├── package.json                  # Dependencias y comandos de desarrollo, análisis y pruebas
│   └── src/
│       ├── main.tsx                  # Inserta la aplicación React en la página
│       ├── App.tsx                   # Asocia las direcciones web con las páginas
│       ├── assets/                   # Logos, imágenes e iconos
│       │
│       ├── pages/
│       │   ├── HomePage.tsx          # Presenta RouteRobots y el acceso a sus demostraciones
│       │   ├── DemoPage.tsx          # Reúne selección de robot, mapa y solicitud de una ruta
│       │   └── SimulationPage.tsx    # Conecta mapa, movimiento, reloj, incidentes y evaluación
│       │
│       ├── components/               # Elementos visibles y controles que utiliza el usuario
│       │   ├── RobotSetupSection.tsx # Permite registrar y seleccionar el robot de la entrega
│       │   ├── RobotModelForm.tsx    # Permite ingresar las especificaciones de un modelo
│       │   ├── SimulationIncidentSection.tsx
│       │   │                         # Reúne creación de incidentes, reportes aleatorios e historial
│       │   ├── IncidentHistory.tsx   # Muestra descripción, efecto, informante y vigencia de los reportes
│       │   ├── RandomFleetReports.tsx
│       │   │                         # Muestra el próximo reporte, sus contadores y las notificaciones
│       │   ├── SurfaceIncidentEditor.tsx
│       │   │                         # Muestra tipo, efecto, duración y controles de ubicación del incidente
│       │   ├── incident-map-editor.ts
│       │   │                         # Dibuja y permite mover, redimensionar y girar la selección en Leaflet
│       │   └── simulation/
│       │       └── SimulationPanels.tsx
│       │                             # Presenta controles del escenario, métricas y resultado del desvío
│       │
│       ├── hooks/                    # Mantienen el estado y responden a acciones o cambios de tiempo
│       │   ├── useScenarioClock.ts   # Mantiene la fecha simulada y permite pausar o acelerar el reloj
│       │   ├── useRobotSimulation.ts # Calcula posición, distancia recorrida y parte pendiente de la ruta
│       │   ├── useSimulationMap.ts   # Actualiza robot, recorrido e incidentes sin reconstruir todo el mapa
│       │   ├── useReplanning.ts      # Conecta los botones y estados de React con la solicitud del desvío
│       │   ├── useSimulationIncidents.ts
│       │   │                         # Carga reportes y comunica cuáles están activos o afectan al recorrido
│       │   ├── useSurfaceIncidentEditor.ts
│       │   │                         # Solicita ubicación y vista previa y coordina confirmación y guardado
│       │   ├── useIncidentMapEditing.ts
│       │   │                         # Activa las interacciones del mapa al editar y las retira al terminar
│       │   ├── useRandomReportScheduler.ts
│       │   │                         # Envía reportes cuando vence su intervalo y conserva pedidos fallidos
│       │   └── useFleetNotifications.ts
│       │                             # Conserva los avisos recientes y retira la notificación temporal
│       │
│       ├── api/
│       │   ├── client.ts             # Envía peticiones HTTP, combina cancelación y timeout y trata errores
│       │   └── validation.ts         # Comprueba valores básicos recibidos: números, fechas y coordenadas
│       │
│       ├── features/
│       │   ├── incidents/
│       │   │   ├── incident-api.ts   # Pide historial resumido, geometrías activas o detalle de un reporte
│       │   │   ├── incident-rules.ts # Decide vigencia y detecta bloqueos que alcanzan la ruta pendiente
│       │   │   ├── incident-validation.ts
│       │   │   │                     # Rechaza reportes o vistas previas con datos incompletos o inválidos
│       │   │   ├── editor-api.ts     # Solicita al backend ubicación, comprobación del área y guardado
│       │   │   ├── editor-state.ts   # Exige confirmar la ubicación y permite restaurarla al cancelar
│       │   │   ├── editor-submission.ts
│       │   │   │                     # Conserva ID y fecha al reintentar para no duplicar un incidente
│       │   │   ├── random-reports-api.ts
│       │   │   │                     # Solicita un reporte aleatorio y valida la respuesta del servidor
│       │   │   └── report-schedule.ts
│       │   │                         # Conserva el pedido original y avanza desde la fecha programada
│       │   │
│       │   ├── pedestrian/
│       │   │   ├── network-api.ts    # Pide al backend los tramos y comprueba los datos recibidos
│       │   │   ├── network-data.ts   # Reutiliza consultas de una zona y comprueba la versión de la red
│       │   │   └── network-layer.ts  # Dibuja caminos al acercar el zoom y consulta al mover el mapa
│       │   │
│       │   └── simulation/
│       │       ├── routing-api.ts   # Envía origen y destino o solicita la evaluación de un bloqueo
│       │       ├── routing-validation.ts
│       │       │                     # Comprueba que las respuestas contengan rutas y estados válidos
│       │       └── replanning-controller.ts
│       │                             # Pausa la simulación, solicita un desvío y lo carga sin perder progreso
│       │
│       └── utils/
│           ├── incident-icons.ts    # Elige el icono y la etiqueta según el tipo de incidente
│           ├── pedestrian-validation.ts
│           │                         # Comprueba IDs, geometrías y datos de los tramos recibidos
│           ├── random-report-schedule.ts
│           │                         # Sortea el próximo intervalo entre 120 y 180 segundos simulados
│           ├── robot-models.ts       # Valida perfiles y calcula ancho del robot más márgenes laterales
│           ├── route-estimates.ts    # Estima duración y energía a partir de distancia y datos del robot
│           ├── route-geometry.ts     # Detecta cruces con áreas y coincidencias con tramos bloqueados
│           └── simulation-path.ts    # Calcula dónde está el robot según la distancia recorrida
│
├── shared/
│   ├── contracts/                    # Define los datos que frontend y backend intercambian
│   │   ├── geography.ts              # Coordenadas y límites de una zona
│   │   ├── robots.ts                 # Características operativas, dimensiones y modelos
│   │   ├── incidents.ts              # Tipos, efectos, fechas y datos del historial y mapa
│   │   ├── pedestrian.ts             # Tramos, conexiones y versión de la red
│   │   ├── routing.ts                # Recorridos calculados y resultados de evaluación
│   │   └── surfaces.ts               # Áreas peatonales y rectángulos utilizados al dibujar incidentes
│   ├── geometry/
│   │   └── rectangles.ts             # Comprueba si un segmento toca o atraviesa un rectángulo
│   ├── routing/
│   │   └── replanning-endpoints.ts   # Usa la posición actual y el destino aceptado para pedir el desvío
│   ├── async/
│   │   ├── latest-read.ts            # Cancela la lectura anterior cuando comienza una nueva
│   │   └── read-cache.ts             # Comparte consultas iguales sin que cancelar una corte las demás
│   ├── surfaces.ts                   # Comprueba puntos y cruces y convierte coordenadas a metros locales
│   └── values.ts                     # Compara datos recibidos para reutilizarlos si no cambiaron
│
├── docs/
│   ├── AUDITORIA.md                  # Registra componentes revisados, hallazgos y verificaciones
│   ├── Aprendizaje.md                # Registra reflexiones y conocimientos adquiridos
│   └── assets/                       # Diagramas e imágenes de la documentación
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # Ejecuta automáticamente análisis, compilación y pruebas
│
├── AI-DECISIONS.md                    # Registra la asistencia de IA y la revisión humana
└── README.md                         # Presenta el proyecto, su alcance y cómo acceder a él
```