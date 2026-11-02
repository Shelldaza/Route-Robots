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


- **Validación de batería para completar el recorrido y regresar**

Al preparar la simulación, el usuario indicará la carga inicial del robot mediante un porcentaje entre **0 y 100**, con **100 % predeterminado**.

Antes de habilitar el inicio, el backend estimará la energía necesaria para llegar al destino y regresar al punto de partida. El cálculo utilizará las distancias de ambos recorridos y el consumo de referencia del modelo.

Se exigirá que, después del regreso, permanezca una reserva mínima equivalente al **20 % de la capacidad total de la batería**:

Si la carga resulta insuficiente o no puede verificarse un recorrido de regreso, la simulación no podrá comenzar y se informará el motivo.

La comprobación se repetirá al aceptar un desvío, considerando la batería restante y el nuevo recorrido pendiente.

Esta función utiliza estimaciones del simulador. No contempla todavía consumos por espera, pendiente, clima o desgaste de batería, por lo que no constituye una garantía de autonomía física.




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

## 4. Auditoría del backend

La revisión comprende las rutas HTTP, los esquemas de validación, los servicios, los repositorios, los contratos internos, los scripts y la configuración del servidor.

Se distinguen tres estados a lo largo del documento:

- **Comportamiento observado:** comportamiento identificado en el código revisado.
- **Hallazgo:** problema reproducido o limitación observada mediante lectura.
- **Cambio previsto:** decisión pendiente de implementación y verificación.

La evidencia de las comprobaciones se concentra en el capítulo 8. Las prioridades y los criterios de cierre se reúnen en el capítulo 10.

### 4.1. Arquitectura y alcance del MVP

La separación general de responsabilidades es adecuada y se conservará.

| Componente | Responsabilidad |
|---|---|
| `routes` | Recibir solicitudes, validar sus datos y devolver respuestas HTTP. |
| `schemas` | Definir los formatos y valores admitidos durante la ejecución. |
| `services` | Aplicar reglas de negocio y coordinar los cálculos. |
| `repositories` | Ejecutar consultas y escrituras en PostgreSQL. |
| `types` | Describir estructuras internas y relaciones entre datos. |
| `scripts` | Preparar la red y realizar diagnósticos. |
| `app.ts` | Construir Express y registrar sus componentes. |
| `db.ts` | Configurar el pool de conexiones. |
| `index.ts` | Iniciar el servidor y gestionar su ciclo de vida. |

No se propone reescribir los motores ni dividir más archivos sin una necesidad concreta.

Como ajuste de organización, los esquemas se importarán directamente desde sus archivos de definición, evitando dependencias innecesarias hacia servicios que cargan motores de cálculo.

El diseño acordado establece:

1. Calcular recorridos mediante el grafo peatonal local y el motor de superficies.
2. Retirar OpenRouteService y el modo de cálculo externo.
3. Coordinar la replanificación directamente desde el backend.
4. Registrar incidentes únicamente sobre superficies.
5. Conservar los tramos del grafo para buscar rutas y descartar conexiones internamente.
6. Completar faltantes cartográficos mediante GeoJSON versionado.
7. Adaptar los contratos y el esquema de datos a este alcance.

### 4.2. API y validación de solicitudes

La API utiliza Express y expone sus endpoints bajo /api. El lector JSON está configurado con un límite de 1 MB por solicitud. Este control restringe el tamaño del cuerpo, pero no la frecuencia ni el costo de las operaciones. Su adecuación deberá comprobarse con las solicitudes previstas para el MVP.

Las rutas delegan las operaciones en servicios. El registro de un robot, por ejemplo, recibe su nombre y un modelo existente. Sus capacidades se recuperan del modelo almacenado.

**Endpoints previstos**

| Método y ruta | Función |
|---|---|
| `GET /api/health` | Confirmar que el proceso HTTP responde. |
| `GET /api/robots` y `POST /api/robots` | Consultar y registrar unidades asociadas a modelos. |
| `GET /api/robot-models` y `POST /api/robot-models` | Consultar y registrar perfiles de simulación. |
| `POST /api/routes` | Calcular recorridos mediante la red local. |
| `GET /api/pedestrian-network` | Consultar versión de red y tramos por zona. |
| `GET /api/incidents/catalog` | Obtener tipos y valores predeterminados de incidentes. |
| `GET /api/surfaces` | Consultar superficies oficiales y complementarias. |
| `POST /api/surfaces/context` | Preparar el contexto del escenario. |
| `POST /api/surfaces/placement` y `POST /api/surfaces/preview` | Ubicar y comprobar una selección antes de guardarla. |
| `POST /api/surfaces/incidents` | Registrar un incidente sobre superficies. |
| `GET /api/surfaces/snapshot` y `GET /api/surfaces/history` | Consultar geometrías activas, resúmenes y detalle histórico. |
| `POST /api/replanning` | Calcular y validar una alternativa desde un único flujo. |

Esta tabla describe el contrato objetivo. Antes de retirar una ruta se revisarán sus consumidores y se conservarán las consultas que continúen siendo necesarias. La creación del escenario y su asociación con una sesión también requieren concretar su contrato.

Se eliminarán la creación por rectángulo general y el registro por selección de tramos. El generador aleatorio actual de incidentes permanecerá desactivado mientras dependa de ese mecanismo.

**Una solicitud inválida puede continuar por otro flujo**

Actualmente, si una solicitud de replanificación no supera la validación del router de superficies, se pasa al router general en lugar de rechazarse. Este puede ignorar campos como `preferredCoordinates`, que contiene el recorrido preferido, y continuar con los datos restantes.

También puede ocurrir cuando falta el contexto necesario para evaluar superficies.

**Consecuencia:** el backend puede procesar una solicitud distinta de la enviada, sin informar que descartó información o cambió de flujo.

**Cambio previsto:** utilizar una única entrada de replanificación. Los datos inválidos devolverán `400` y la falta de preparación del escenario se informará explícitamente. La solicitud no continuará por otro mecanismo para evitar el rechazo.

**Separación entre la solicitud del usuario y las restricciones del cálculo**

El esquema actual permite recibir parámetros como `blockedSegmentIds`, `surfaceIncidentIds`, `strictOrigin` y `blockedAreas`. Estos indican qué obstáculos evitar y cómo ajustar el inicio del recorrido.

El backend no debe depender de que el navegador envíe correctamente todas las restricciones. Una solicitud puede estar incompleta, desactualizada o manipulada.

**Cambio previsto:** el usuario enviará el escenario y los datos necesarios para solicitar la ruta. El backend comprobará ese contexto, consultará los incidentes vigentes y preparará los parámetros del motor.

Esto protege la coherencia del cálculo y reduce la confianza en datos del cliente. Los identificadores de tramos seguirán disponibles para uso interno, aunque se retire su selección manual para registrar incidentes.

**Validaciones previstas**

- **Versión de red:** exigir que `networkVersion` identifique la red local cargada. Así se evita calcular con una versión diferente de la utilizada por el escenario.
- **Fecha del escenario:** exigirla en las evaluaciones de incidentes. Si falta, no sustituirla silenciosamente por la hora real.
- **Campos admitidos:** rechazar propiedades que no formen parte de la solicitud, en lugar de ignorarlas y continuar.
- **Zona de demostración:** utilizar los mismos límites geográficos en las operaciones que deban restringirse al sector elegido. Definir también si los desvíos pueden salir de él, porque comprobar únicamente origen y destino no limita el camino completo.
- **Resultados numéricos:** comprobar que cálculos como `ancho / 2 + margen` produzcan valores finitos y válidos. Validar cada dato por separado no garantiza que su combinación sea válida.

**Formato común de errores**

Se unificará el formato de respuesta ante JSON inválido, solicitudes demasiado grandes, endpoints inexistentes y errores inesperados.

Se incorporará un manejo central que conserve los códigos correspondientes y devuelva mensajes controlados, sin trazas internas.

### 4.3. Modelos, robots y catálogo de incidentes

La separación entre perfiles y unidades se conservará. Un modelo define capacidades y varios robots pueden utilizarlo sin duplicarlas.

**Límites operativos acordados**

| Característica | Rango |
|---|---|
| Velocidad | Mayor que 0 y hasta 20 km/h. |
| Capacidad de batería | Mayor que 0 y hasta 10.000 Wh. |
| Consumo de referencia | Mayor que 0 y hasta 200 Wh/km. |

Estos límites delimitan los perfiles admitidos por la demostración. No representan máximos físicos universales.

Deberán coincidir en formulario, backend y PostgreSQL.

Se conservarán el ancho y el margen lateral por lado porque intervienen en la evaluación del espacio disponible. Se retirarán el largo y la pendiente máxima, que no participan en el cálculo actual, junto con la procedencia y las notas de los perfiles identificados como simulados.

La retirada de la pendiente responde al alcance funcional, no a una suposición sobre el relieve de Washington.

Los máximos de ancho y margen siguen pendientes de definición. También se comprobará que el radio utilizado en geometría sea finito. Las medidas desconocidas se distinguirán de cero.

La carga inicial de batería se elegirá al preparar el recorrido, con **100 % predeterminado y editable**. La energía disponible será la capacidad multiplicada por la fracción de carga.

**Validación de autonomía**

El porcentaje inicial admitirá valores entre 0 y 100. Antes de habilitar el inicio, el backend comprobará que la energía disponible alcance para el recorrido de ida, el regreso al punto de partida y una reserva equivalente al 20 % de la capacidad total.

Si la energía resulta insuficiente o no puede verificarse el regreso, se informará el motivo y no se permitirá comenzar. La comprobación se repetirá antes de aceptar un desvío, utilizando la energía restante estimada.

Esta evaluación utiliza el consumo de referencia del modelo y las distancias calculadas. No constituye una garantía de autonomía física.


**Catálogo de incidentes**

El catálogo centralizado se conservará. Define etiquetas, descripciones, efectos, duraciones predeterminadas e iconos.

Sus valores son referencias del simulador y no acreditan la duración de un incidente real. Las descripciones deberán evitar contradicciones cuando cambie el efecto, como afirmar que el paso está cerrado en un aviso de precaución.

### 4.4. Persistencia e integridad de datos

El backend utiliza PostgreSQL mediante `pg`, con un pool de hasta **cinco conexiones por proceso**.

Las consultas revisadas utilizan parámetros para los datos recibidos. No se identificó concatenación insegura de entradas en el SQL examinado. Los controles de autorización se tratan por separado en el capítulo 7.

**Esquema acordado**

| Tabla | Contenido principal |
|---|---|
| `robot_models` | Nombre, velocidad, capacidad de batería, consumo, ancho, margen lateral y creación. |
| `robots` | Nombre, modelo asociado y creación. |
| `incidents` | Simulación, tipo, origen del reporte, descripción, efecto, informante, creación, inicio y vencimiento. |
| `incident_surfaces` | Geometría e información cartográfica necesarias para representar y evaluar el incidente. |
| `simulation_contexts` | Simulación, robot, versión de red, dimensiones conservadas, porcentaje inicial de batería y creación. |

Todas conservarán sus identificadores y relaciones. `simulation_contexts` sustituirá a `surface_scenarios`.

Se retirarán `pedestrian_impact` y las columnas `south`, `west`, `north` y `east` de los incidentes. Los límites necesarios para representación o consultas se obtendrán de la geometría.

Esto no elimina los rectángulos geográficos utilizados para consultar zonas del mapa.

**Consolidación del esquema**

Las migraciones históricas se consolidarán en un esquema inicial para una base vacía. Los datos actuales son ficticios y pueden regenerarse, por lo que se acepta reiniciar la base.

La evolución anterior permanecerá en Git. La carga de modelos y robots de demostración estará separada del esquema. Los cambios posteriores utilizarán nuevas migraciones con seguimiento de su aplicación.

Esta decisión simplifica la preparación de la base y permite representar directamente el diseño acordado. No constituye un procedimiento de actualización para bases cuyos datos deban conservarse.

**Guardado conjunto del incidente y su geometría**

Actualmente existen dos operaciones de registro. Una guarda únicamente el incidente y otra guarda el incidente junto con su geometría mediante una transacción.

Como todos los incidentes del MVP deberán tener geometría asociada, se utilizará una operación común de persistencia. Los servicios podrán preparar de manera diferente los reportes manuales, iniciales o interpretados por IA, pero compartirán las mismas garantías de guardado.

Si falla cualquiera de las escrituras, se revertirá la operación completa. Si también falla la reversión, se descartará la conexión. Esto evita conservar registros incompletos.

**Reintentos sin duplicados y conflictos de identificador**

Una solicitud puede haberse guardado aunque el navegador no haya recibido la respuesta. Por eso, al reintentar se conservará el mismo identificador.

Actualmente, el repositorio general puede devolver el registro existente sin comprobar que sus datos coincidan con los enviados. Esto puede presentar como guardado un reporte diferente.

**Cambio previsto:** devolver el registro existente únicamente si corresponde al mismo reporte. Se compararán la simulación, la ubicación y los demás datos que lo definen. Si el identificador pertenece a otro contenido, se responderá con un conflicto `409`, sin sobrescribir ni devolver el reporte ajeno.

**Pertenencia del incidente y origen del reporte**

Cada operación deberá comprobar que el incidente pertenece a la simulación indicada y que la sesión tiene permiso para acceder a ella. El detalle histórico ya verifica la pertenencia y conservará ese control.

El backend asignará el origen y el informante según el mecanismo de creación. No se guardarán siempre como `manual` y `Usuario`, porque también existirán incidentes iniciales y reportes simulados de robots.

Una descripción enviada desde el navegador o interpretada por IA no se utilizará como prueba de identidad. Los informantes ficticios se identificarán como simulados.

**Consultas históricas**

La separación entre resúmenes y geometrías activas evita transferir cartografía innecesaria para todos los registros.

El historial completo puede mantenerse inicialmente. Su tamaño se medirá con el conjunto de incidentes de la demostración antes de decidir si necesita límites o paginación.


### 4.5. Planificación y validación geométrica

El grafo compacto utiliza A* para buscar recorridos por distancia. El motor de superficies comprueba si existe espacio para rodear un obstáculo, considerando el ancho del robot y su margen lateral.

Se conservarán los controles que permiten:

- Comprobar la integridad del archivo de red al cargarlo.
- Verificar que los recorridos recibidos del frontend correspondan al grafo o a superficies admitidas.
- Respetar los límites y huecos de las superficies.
- Recuperar conexiones conocidas, incluyendo retroceso cuando corresponda.
- Conservar el origen y el destino aceptados.
- Consultar nuevamente los incidentes antes de entregar una alternativa.
- Mantener las precauciones y los avisos sin convertirlos automáticamente en cierres.

**Contacto con esquinas de obstáculos**

Se reprodujo un caso en el que `lineHits()` no detecta que una trayectoria toca la esquina de un obstáculo, mientras otra función reconoce ese punto como parte del área.

**Consecuencia:** una misma trayectoria puede considerarse libre o en contacto con el obstáculo según la comprobación utilizada.

**Cambio previsto:** aplicar un criterio común de contacto con obstáculos y sus márgenes en la vista previa, la adaptación y la validación final. Se distinguirá este contacto del permitido con los límites de una superficie transitable.

**Ajuste de la posición inicial después del cálculo**

El motor comienza la búsqueda desde un punto de la red cercano a la posición del robot. Después, con `strictOrigin`, sustituye el inicio del recorrido por la posición real recibida.

Se reprodujo que este cambio puede introducir un segmento que atraviesa una zona bloqueada, aunque el recorrido calculado inicialmente no lo hiciera.

**Cambio previsto:** comprobar la unión entre la posición del robot y la red, junto con la trayectoria final. Cambiar el punto inicial no deberá permitir eludir las restricciones.

La reproducción utilizó un área rectangular. Al retirar ese mecanismo, se incorporará una prueba equivalente con obstáculos sobre superficies.

**Clasificación de errores**

El adaptador convierte cualquier excepción del grafo en `422` y conserva su mensaje.

Se distinguirán los fallos esperados del cálculo de los errores inesperados. Estos últimos se registrarán de forma controlada y devolverán un mensaje general.

**Límites del procedimiento**

Agotar tiempo, candidatos o intentos significa que no se encontró una alternativa verificable dentro de la búsqueda. No demuestra que físicamente no exista paso.

La recuperación devuelve la primera alternativa válida según el orden de conectores evaluado. No garantiza el menor desvío total.

La selección del acceso más cercano también puede fallar cuando está bloqueado. Cualquier ampliación de la búsqueda deberá evitar conexiones injustificadas entre caminos o veredas.

La duración local utiliza actualmente 5 km/h. El tiempo operativo del robot y el consumo se calculan por separado con su velocidad y la expresión `distancia en km × Wh/km`. La interfaz deberá distinguir estas métricas.

### 4.6. Superficies complementarias e incidentes iniciales

**Completar los faltantes cartográficos**

Los faltantes del sector elegido se completarán mediante un archivo GeoJSON versionado en el repositorio. No se incorporará una tabla ni un editor administrativo para esta función.

Cada superficie indicará su procedencia, distinguiendo las correcciones respaldadas por información disponible de los espacios ficticios del simulador.

Los complementos se incorporarán tanto al mapa como al servicio cartográfico utilizado por el motor. Dibujarlos únicamente en el frontend no permite utilizarlos en la evaluación.

Antes de incorporarlos se comprobarán:

- Identificadores únicos, sin conflictos con las superficies existentes.
- Coordenadas y polígonos válidos, incluidos sus límites y huecos.
- Ausencia de autointersecciones y existencia de un área útil.
- Compatibilidad con la cartografía utilizada.
- Una versión que permita identificar el conjunto evaluado.

Agregar una superficie no conecta automáticamente caminos separados en el grafo. Se comprobará que los complementos permitan resolver los recorridos previstos sin introducir uniones injustificadas.

**Incidentes iniciales independientes por simulación**

Cada simulación recibirá una copia del conjunto inicial, con identificadores propios y fechas definidas respecto de su reloj. Crear o modificar incidentes en un escenario no alterará los demás.

Se conservará la geometría original de cada obstáculo. El área utilizada para comprobar colisiones se calculará según el ancho y el margen lateral del robot del escenario, sin reutilizar una ampliación preparada para otro robot.

También se separará el registro de un incidente de la evaluación del paso. La falta de dimensiones no impedirá registrar un aviso informativo o de precaución, aunque pueda impedir determinados cálculos.

Antes de aceptar el recorrido inicial o un desvío, el backend comprobará los incidentes vigentes que puedan afectarlo. Cargar el conjunto inicial no sustituye esta evaluación.

### 4.7. Replanificación e integración de IA

El flujo actual utiliza Claude y MCP para solicitar operaciones que ya ejecuta el backend: consultar incidentes y calcular un desvío.

La consulta inicial se fuerza, pero el cálculo posterior puede no solicitarse. Además, una alternativa calculada puede no entregarse si falla la explicación final.

**Decisión acordada**

La coordinación se trasladará a un servicio directo del backend. Se conservarán:

- El contexto fijo de la evaluación.
- La reutilización de consultas.
- La construcción de restricciones.
- La validación del recorrido.
- La comparación final de identificadores y contenido de los incidentes.

`RoutingServices` se trasladará a un contrato independiente. Después de adaptar consumidores y pruebas, se retirarán el agente y la sesión MCP que hayan quedado sin uso.

Las pruebas reutilizadas deberán corregir datos incoherentes y conservar las garantías relevantes, incluido el tratamiento de errores y la detección de cambios durante una evaluación.

No se atribuye toda la demora a Claude. El procesamiento geométrico también requiere medición. Este cambio elimina las llamadas al modelo del flujo necesario para obtener un desvío.

Durante el desarrollo se revisó qué responsabilidades justificaban el uso de IA. Se concluyó que la coordinación del cálculo puede resolverse mediante reglas del backend, mientras que la interpretación de reportes y la generación de indicaciones preventivas se ajustan mejor al propósito previsto para la IA.

**Funciones previstas de IA**

La IA interpretará mensajes de robots y generará instrucciones preventivas basadas en el recorrido, las capacidades del robot y los incidentes verificados. El objetivo será anticipar situaciones que puedan afectar el desplazamiento y reducir la necesidad de intervención humana.

Inicialmente, estas funciones podrán utilizar llamadas con entradas preparadas y respuestas validadas, sin un agente que seleccione herramientas.

El backend decidirá qué datos acepta y qué operaciones permite. Una respuesta de IA no acreditará identidad, veracidad ni transitabilidad, ni sustituirá la validación geométrica.

Estas funciones y la clasificación de rutas permanecen pendientes de implementación. Su utilidad y su efecto sobre la intervención humana deberán evaluarse dentro del simulador.

### 4.8. Retirada de OpenRouteService

OpenRouteService se utiliza cuando se desactiva el modo peatonal local. El MVP acordado no necesita ese segundo motor.

Se retirarán el selector, el adaptador, `ORS_API_KEY` y las pruebas exclusivas del proveedor después de revisar sus consumidores. Las solicitudes deberán utilizar una versión local válida.

La retirada reduce código, credenciales, cuotas externas y caminos de error. También reduce la superficie de ataque al eliminar una integración innecesaria para el MVP. Esto no implica que el proveedor sea inseguro.

Las líneas peatonales, el grafo, las superficies y el fondo del mapa seguirán disponibles.

### 4.9. Recursos, cancelación y operación

**Tiempo y cantidad de cálculos**

Los límites actuales controlan algunas búsquedas, pero no necesariamente toda la evaluación de un recorrido. Una solicitud puede realizar varios intentos y operaciones adicionales.

Se medirá el tiempo total y se establecerán límites para evitar que una evaluación ocupe el servidor durante demasiado tiempo. También se controlará cuántos cálculos costosos pueden ejecutarse simultáneamente.

Que el navegador deje de esperar una respuesta no significa que el servidor haya detenido el trabajo.

**Memoria utilizada por la cartografía**

Actualmente, algunos controles de tamaño se aplican después de descargar o procesar los datos. Por eso, una respuesta excesiva puede consumir memoria antes de ser rechazada.

Los límites se aplicarán durante la descarga y el procesamiento. También se controlará el volumen total de incidentes y superficies evaluados, porque varios elementos válidos por separado pueden resultar excesivos al combinarse.

**Cancelación de operaciones**

Las consultas de superficies ya permiten cancelar trabajo que dejó de ser necesario. Si varios consumidores comparten una consulta, cancelar uno no interrumpe a los demás.

Este mecanismo se extenderá al nuevo servicio de replanificación donde sea posible. Cancelar una solicitud no deshace un guardado ya confirmado ni garantiza detener inmediatamente todos los cálculos.

**Consultas a PostgreSQL**

El tiempo máximo para obtener una conexión no limita cuánto puede durar una consulta una vez iniciada.

Se establecerá un límite de duración adecuado para evitar consultas que mantengan recursos ocupados indefinidamente. La seguridad de la conexión y los permisos se revisan en el capítulo 7.

**Inicio y cierre del servidor**

Se comprobará que el puerto configurado sea válido y se informarán los errores que impidan iniciar el servicio.

Al apagar o reiniciar el backend, se dejarán de aceptar nuevas solicitudes y se permitirá finalizar las operaciones en curso dentro de un plazo máximo. Después se cerrarán las conexiones con PostgreSQL.

`/api/health` seguirá indicando que la API responde. No se utilizará como prueba de que la base de datos o el esquema funcionan correctamente.

### 4.10. Tipos y scripts

**Estructuras de datos**

Se mantendrá la diferencia entre las fechas utilizadas dentro del backend, representadas como `Date`, y las enviadas mediante JSON, representadas como texto.

Los tipos se actualizarán para reflejar el MVP acordado:

- Eliminar los campos y variantes de incidentes que se retiren.
- Exigir geometría en los incidentes completos.
- Mantener resúmenes históricos sin geometría.
- Incluir la versión de red en los recorridos calculados.

La lista `segmentIds` no será obligatoria para todas las rutas. Algunas maniobras utilizan superficies y no pueden describirse únicamente mediante identificadores de tramos.

Los tipos ayudan a detectar incompatibilidades durante el desarrollo, pero no sustituyen la validación de los datos recibidos.

**Scripts que se conservarán**

| Script | Función y alcance |
|---|---|
| `check-ai.ts` | Realiza una llamada breve a Claude para comprobar credencial, modelo y respuesta. Consume tokens reales. No verifica las funciones de interpretación o prevención. |
| `check-db.ts` | Ejecuta `SELECT 1` para comprobar la conexión con PostgreSQL. No verifica tablas, migraciones ni restricciones. |
| `update-pedestrian-network.mjs` | Descarga y procesa los caminos utilizados para preparar la captura de la red peatonal. |
| `prepare-pedestrian-network.ts` | Convierte la captura al formato compacto utilizado por el backend o descomprime el archivo preparado. |

**Preparación de la red**

Se comprobará el contenido de la captura antes de convertirla y el archivo generado antes de reemplazar la versión utilizada por la aplicación. Una declaración de tipo con `as` no comprueba que los datos del archivo sean válidos.

También se eliminarán los archivos temporales que puedan quedar después de un fallo.

La descarga y preparación de la red se realizarán fuera del proceso que atiende solicitudes, para evitar competir por su memoria y capacidad de cálculo.

La captura puede omitir caminos o restricciones existentes. Por eso, se comprobarán la cobertura y las conexiones del sector elegido antes de utilizarlo en la demostración.
