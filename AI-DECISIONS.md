# AI Decision Log

## Decisión sobre la arquitectónica inicial: Selección de Stack Tecnológico Gratuito (SaaS)

- **Problema abordado:** Definición de una arquitectura Cloud-Native que cumpla con los requisitos del TP (escalabilidad, servicios gestionados, despliegue real) sin incurrir en costos de infraestructura (reemplazo del plan original en Azure).
- **Prompt / Herramienta utilizada:** "El TP pide despliegue real en la nube pero no tengo presupuesto para Azure. ¿Cómo justifico y construyo esto gratis cumpliendo los requisitos?" (Herramienta: Gemini).
- **Código / Arquitectura generada:** La IA propuso un stack distribuido gratuito utilizando Vercel para el Frontend (PaaS), Render para el Backend Node.js, y Neon.tech para persistencia PostgreSQL Serverless. Sugirió el uso de Github Actions para CI/CD y Sentry para observabilidad.
- **Validación y Corrección Humana:** Se validó la viabilidad de la propuesta frente a las restricciones del Trabajo Práctico ("Libertad Tecnológica Justificada"). Se acepta la arquitectura propuesta ya que Vercel y Render cumplen con la premisa de "Servicios Gestionados" minimizando la carga operativa. Se asume el riesgo de "cold starts" en la capa gratuita de Render (backend), considerándolo aceptable para la etapa de MVP.

## Resolución de Bug: Incompatibilidad de entorno de ejecución TypeScript

- **Problema abordado:** Error crítico al levantar el servidor de desarrollo (`TypeError: Cannot read properties of undefined (reading 'fileExists')`). Se detectó que el motor de ejecución estaba fallando en Node.js v22.18.0.
- **Prompt / Herramienta utilizada:** Se le pasó el log de error completo a la IA (Gemini) indicando la versión exacta de Node.js utilizada en el entorno local.
- **Código / Arquitectura generada:** La IA identificó un bug de compatibilidad conocido entre dependencias modernas y la librería tradicional `ts-node`. Recomendó desinstalar `ts-node` y reemplazarlo por `tsx` (TypeScript Execute), actualizando el script `dev` en el `package.json`.
- **Validación y Corrección Humana:** Se investigó la sugerencia de la IA y se adoptó tsx para el entorno utilizado y, tras el cambio, el servidor inició correctamente para versiones recientes de Node.js (v20+). Se aplicó el cambio, lo que resolvió el error inmediatamente.


## Mejora de la presentación del README

- **Problema abordado:** Mejorar la claridad y organización del README para presentar la propuesta de RouteRobots, el alcance inicial y la arquitectura prevista.
- **Prompt / Herramienta utilizada:** Se solicitó ayuda a ChatGPT para reformular la descripción del proyecto y ordenar la información sobre usuarios objetivo, tecnologías y despliegue.
- **Código / Arquitectura generada:** Se propuso una estructura en Markdown con apartados para la descripción del SaaS, el alcance del MVP, el stack tecnológico, el enlace del backend y el diagrama cloud.
- **Validación y Corrección Humana:** Se revisó la redacción y se incorporaron los cambios en el commit `2a2fd39`. Las funcionalidades descritas representaban la propuesta de esa etapa y no una comprobación de que estuvieran implementadas. Esta entrada se documentó retrospectivamente.

## Incorporación del mapa interactivo

- **Problema abordado:** Incorporar un mapa para preparar visualmente un recorrido en Washington D. C.
- **Prompt / Herramienta utilizada:** Se solicitó ayuda de IA para integrar un mapa interactivo en React y TypeScript.
- **Código / Arquitectura generada:** Se incorporaron Leaflet, sus tipos y una capa de OpenStreetMap con atribución. El mapa se inicializa al montar el componente y se elimina al abandonarlo.
- **Validación y Corrección Humana:** Se revisó que el mapa utilizara Washington como vista inicial, conservara la atribución cartográfica y liberara la instancia al desmontarse. Los cambios quedaron incorporados en el commit `2517664`.

## Selección de origen y destino

- **Problema abordado:** Permitir seleccionar los extremos del recorrido y corregirlos antes de solicitar una ruta.
- **Prompt / Herramienta utilizada:** Se pidió apoyo de IA para implementar la selección mediante clics y mostrar las coordenadas e instrucciones en un panel.
- **Código / Arquitectura generada:** El primer clic establece el origen y el segundo el destino. Se agregaron marcadores diferenciados, instrucciones según la selección y un botón para reiniciarla.
- **Validación y Corrección Humana:** Se revisó que el código limitara la selección a dos puntos, actualizara los marcadores y permitiera reiniciar ambos extremos. Se mantuvo explícito que esta etapa solo selecciona coordenadas y todavía no calcula rutas ni comprueba su transitabilidad. Referencia: commit `2517664`.

## Cálculo de rutas peatonales desde el backend

- **Problema abordado:** Obtener un recorrido entre los puntos seleccionados, manteniendo la credencial del proveedor fuera del navegador.
- **Prompt / Herramienta utilizada:** Se solicitó ayuda de IA para implementar un endpoint que recibiera origen y destino y consultara OpenRouteService.
- **Código / Arquitectura generada:** Se agregó `POST /api/routes`, utilizando `ORS_API_KEY` desde el entorno del backend. Se incorporaron validaciones con Zod para las coordenadas recibidas y la respuesta del proveedor, junto con un timeout de 15 segundos y respuestas de error.
- **Validación y Corrección Humana:** Se revisaron los rangos de latitud y longitud, el orden de coordenadas enviado al proveedor y las comprobaciones de geometría y métricas. Se distinguieron entradas inválidas, configuración ausente, fallos del proveedor y ausencia de ruta que se fueron corrigiendo. El perfil peatonal se adoptó como base del prototipo, sin considerarlo una evaluación específica para robots. Referencia: commit `a516858`.

## Integración del recorrido con el mapa

- **Problema abordado:** Conectar la selección de origen y destino con la API y representar el recorrido obtenido.
- **Prompt / Herramienta utilizada:** Se pidió apoyo de IA para solicitar la ruta desde React, dibujarla con Leaflet y presentar distancia, duración y errores.
- **Código / Arquitectura generada:** Se agregó la solicitud a `/api/routes`, el estado de carga y la representación del recorrido. Se convirtió el orden GeoJSON `[longitud, latitud]` al utilizado por Leaflet y se configuró el proxy de Vite hacia el backend local.
- **Validación y Corrección Humana:** Se revisó que el cálculo requiriera dos puntos, que los botones quedaran deshabilitados durante la solicitud y que reiniciar eliminara selección, ruta y errores. Se incorporaron comprobaciones básicas de la respuesta y se identificó la duración como tiempo peatonal de referencia. Referencia: commit `a516858`.

## Generación de imágenes para la identidad visual

- **Problema abordado:** Contar con imágenes propias para identificar RouteRobots en el encabezado de la página.
- **Prompt / Herramienta utilizada:** Se utilizó Gemini para generar las imágenes del robot y del nombre de RouteRobots.
- **Código / Arquitectura generada:** Se obtuvieron los recursos gráficos incorporados como `robot-logo.jpg` y `routerobots-name.jpg`.
- **Validación y Corrección Humana:** Se seleccionaron las imágenes para utilizarlas juntas como identificación visual del proyecto. Se incorporaron como archivos locales y se definieron tamaños adaptables en el encabezado. Referencia: commit `02242e1`.

## Diseño del encabezado y la portada

- **Problema abordado:** Aplicar una presentación visual a la página inicial e integrar los recursos generados con Gemini.
- **Prompt / Herramienta utilizada:** Se solicitó ayuda a ChatGPT para organizar los estilos del encabezado y la portada e incorporar las imágenes en React.
- **Código / Arquitectura generada:** Se agregó `HomePage.css` con estilos para marca, navegación, botones y presentación principal. También se incorporaron tipografías de Google Fonts y se actualizaron el idioma, el título y la descripción del documento HTML.
- **Validación y Corrección Humana:** Se revisó que las imágenes estuvieran integradas mediante importaciones locales y que el enlace de la marca conservara una etiqueta accesible. Se incluyeron reglas para pantallas pequeñas, foco visible y reducción de movimiento. La revisión del código confirma estos controles, sin implicar una evaluación completa de accesibilidad o de visualización en dispositivos. Referencia: commit `02242e1`.


## Preparación visual del robot y actualización de la demo

- **Problema abordado:** Incorporar la configuración del robot a la preparación de la entrega y mantener una presentación coherente con la portada.
- **Prompt / Herramienta utilizada:** Se solicitó ayuda a ChatGPT para crear el formulario del robot y adaptar el diseño de la página de demostración.
- **Código / Arquitectura generada:** Se agregó `RobotSetupSection` con campos de identificación, velocidad, capacidad de batería, consumo y pendiente máxima. También se actualizaron el encabezado, la navegación y los estilos adaptables de la demo.
- **Validación y Corrección Humana:** Se revisaron las unidades, los campos obligatorios y opcionales y las restricciones básicas de los controles. Se mantuvieron deshabilitados el registro y la selección de robots porque todavía no estaban conectados al backend. Esta etapa incorporó la interfaz, sin guardar datos ni utilizar las capacidades para calcular rutas. Referencia: commit `28de8a7`.

## Estructura base de la pantalla de seguimiento

- **Problema abordado:** Crear una pantalla independiente para visualizar el recorrido calculado y preparar la incorporación posterior del movimiento, los incidentes y la evaluación.
- **Prompt / Herramienta utilizada:** Se solicitó ayuda a ChatGPT para desarrollar la estructura inicial de la página de seguimiento y conectarla con la preparación de la entrega.
- **Código / Arquitectura generada:** Se agregó `SimulationPage` en `/simulacion`, recibiendo la ruta mediante el estado de navegación. Se incorporaron mapa, marcadores de origen y destino, métricas y espacios para controles, evaluación, actividad e incidentes.
- **Validación y Corrección Humana:** Se revisaron las comprobaciones de geometría, coordenadas y métricas antes de representar la ruta. Se incluyó una pantalla alternativa cuando no existe un recorrido válido y se mantuvieron deshabilitados los controles todavía sin implementar. El movimiento, la batería y los incidentes quedaron señalados como pendientes, sin presentar la estructura visual como una simulación funcional. Referencia: commit `3ebde71`.

## Separación del servicio de rutas y soporte de zonas bloqueadas

- **Problema abordado:** Reutilizar el cálculo de rutas fuera del endpoint HTTP e incorporar zonas que el proveedor debía evitar.
- **Prompt / Herramienta utilizada:** Se solicitó ayuda a ChatGPT para extraer el cálculo a un servicio y admitir áreas bloqueadas con validación de coordenadas.
- **Código / Arquitectura generada:** Se creó `calculateRoute()` en `services/routing.ts` y se simplificó el router. Se admitieron hasta diez áreas rectangulares, convertidas en polígonos cerrados para `avoid_polygons` de OpenRouteService. También se incorporó `RoutingError` para conservar códigos y mensajes controlados.
- **Validación y Corrección Humana:** Se revisaron el orden de coordenadas, los límites de las áreas y la conservación del formato utilizado por el frontend. Se incorporaron pruebas con respuestas simuladas para solicitudes con y sin restricciones, áreas inválidas, configuración ausente, respuestas inesperadas, timeout y errores de conexión. Estas pruebas comprueban el envío de los polígonos, pero este commit todavía no verifica geométricamente que la ruta devuelta los evite. Referencia: commit `e19d1b5`.

## Bloqueo de prueba sobre el recorrido

- **Problema abordado:** Disponer de un incidente controlado para preparar la demostración de un recorrido afectado y su posterior desvío.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo incorporar un botón que generara un bloqueo sobre la ruta calculada y lo registrara en el backend.
- **Código / Arquitectura generada:** Se agregó `SimulationIncidentSection`. El componente calcula el punto medio por distancia del recorrido y prepara un área rectangular de aproximadamente 20 metros por lado. Cada simulación recibe un identificador y el reporte se envía a `/api/incidents`.
- **Validación y Corrección Humana:** Se revisaron las comprobaciones que exigen un recorrido de al menos 80 metros y evitan cubrir el origen o el destino. Se incorporaron validaciones de la respuesta y de su correspondencia con la simulación. Antes de crear el bloqueo se consultan los registros existentes para intentar recuperar un guardado cuya respuesta se hubiera perdido. Este mecanismo no constituye por sí solo una garantía completa contra duplicados. Referencia: commit `e5a3a36`.

## Representación del incidente y estado pendiente de resolución

- **Problema abordado:** Mostrar dónde se encuentra el bloqueo y diferenciar su registro de la resolución del problema.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para representar el incidente mediante un icono y actualizar los mensajes del seguimiento sin presentar todavía un desvío como resuelto.
- **Código / Arquitectura generada:** Se incorporó una capa de marcadores con el icono de bloqueo, una referencia en la leyenda y mensajes de estado, evaluación y actividad. El panel muestra la confirmación y el vencimiento del incidente.
- **Validación y Corrección Humana:** Se revisó que la ubicación del icono se obtuviera del área registrada y que la interfaz conservara el recorrido original. Se mantuvo explícito que faltaba solicitar y validar una alternativa y que el movimiento y la resolución automática aún no estaban habilitados. Referencia: commit `e5a3a36`.

## Evaluación de bloqueos y visualización de rutas alternativas

- **Problema abordado:** Conectar el registro de un bloqueo con la evaluación de un desvío y permitir comparar el resultado con el recorrido original.
- **Prompt / Herramienta utilizada:** Se solicitó ayuda a ChatGPT para integrar la pantalla con el endpoint de replanificación mediante IA y MCP, mostrando la alternativa y su explicación.
- **Código / Arquitectura generada:** Al registrar un bloqueo se solicita `/api/replanning` con la simulación, el origen y el destino. Se incorporaron estados de carga, resultado y error, un botón de reintento y la representación diferenciada de la ruta original y la alternativa. También se muestran la explicación, las herramientas ejecutadas y la diferencia de distancia.
- **Validación y Corrección Humana:** Se revisaron las comprobaciones de estructura de la respuesta y la condición que permite mostrar una alternativa únicamente cuando llega con estado `alternative_ready` y una ruta válida. Se incorporaron protección frente a solicitudes simultáneas y cancelación al abandonar la pantalla. Se distinguió un fallo de evaluación de un resultado sin alternativa y se mantuvo explícito que el robot todavía no se movía. Referencia: commit `5980ded`.

## Movimiento del robot sobre el recorrido

- **Problema abordado:** Pasar de una ruta estática a una simulación que mostrara el avance del robot según su velocidad operativa.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo representar un desplazamiento continuo sobre las coordenadas del recorrido, evitando avanzar simplemente de un punto al siguiente.
- **Código / Arquitectura generada:** Se incorporaron `simulation-path.ts` y `useRobotSimulation`. El recorrido se organiza por distancia acumulada y la posición se obtiene mediante interpolación. Se agregaron inicio, pausa, reanudación, multiplicadores ×1, ×10 y ×60 y avance manual de dos minutos.
- **Validación y Corrección Humana:** Se revisaron la conversión de km/h a m/s y el límite de avance para no superar el destino. Se incorporaron pruebas de posición intermedia, recorridos con varios segmentos, coordenadas repetidas y trayectorias sin longitud. Referencia: commit `27ea29b`.

## Replanificación desde la posición actual

- **Problema abordado:** Evitar que un desvío se solicitara desde el origen inicial cuando el robot ya había avanzado.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para utilizar la posición donde se pausa el robot como origen de la replanificación, conservando el destino y el progreso acumulado.
- **Código / Arquitectura generada:** Antes de solicitar el desvío se pausa el movimiento y se obtiene su estado actual. La solicitud utiliza esa posición como origen. Al cargar la alternativa se conservan tiempo y distancia acumulados y se espera una reanudación explícita.
- **Validación y Corrección Humana:** Se revisó el uso de la posición actual y la conservación de acumulados. La diferencia de distancia pasó a compararse con el recorrido pendiente. Esta implementación todavía no comprueba que el primer punto de la alternativa coincida con la posición pausada, por lo que conservar los acumulados no garantiza por sí solo la continuidad espacial. Referencia: commit `27ea29b`.

## Coordinación entre movimiento e incidentes

- **Problema abordado:** Generar el bloqueo por delante del robot y evitar que continuara avanzando durante su registro o evaluación.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo coordinar la creación del incidente con la pausa del robot y el cálculo de una alternativa.
- **Código / Arquitectura generada:** El generador pasó a utilizar las coordenadas pendientes. Se añadieron callbacks para pausar antes del registro y comunicar que existe una operación en curso. Los controles de movimiento se bloquean durante el guardado, la evaluación o mientras el bloqueo siga sin resolver.
- **Validación y Corrección Humana:** Se revisaron las comprobaciones de distancia mínima y de exclusión de la posición actual y el destino del área bloqueada. Se mantuvo la reanudación manual después de cargar el desvío. Referencia: commit `27ea29b`.

## Presentación del progreso y consumo acumulado

- **Problema abordado:** Diferenciar las estimaciones del recorrido mostrado de lo que el robot ya había recorrido.
- **Prompt / Herramienta utilizada:** Se solicitó apoyo a ChatGPT para presentar el progreso y adaptar las métricas al movimiento y a los desvíos.
- **Código / Arquitectura generada:** Se incorporó un marcador móvil y se utilizaron la distancia acumulada y el consumo de referencia para estimar la energía consumida. Los títulos distinguen las métricas del recorrido original de las del desvío.
- **Validación y Corrección Humana:** Se revisó que el consumo acumulado utilizara la distancia recorrida y que los textos explicaran las limitaciones del cálculo. El porcentaje mostrado continuó representando capacidad requerida, sin presentarse como batería restante. Referencia: commit `27ea29b`.

## Pruebas del agente y control de llamadas

- **Problema abordado:** Comprobar que el agente respetara el flujo permitido y que una explicación del modelo no se aceptara como sustituto de una ruta calculada.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT qué casos convenía probar para verificar la coordinación con IA y MCP sin utilizar credenciales reales ni realizar llamadas pagas.
- **Código / Arquitectura generada:** Se incorporaron pruebas con Vitest y respuestas simuladas del cliente de OpenAI y de la sesión MCP. Cubren el flujo exitoso, la ausencia de bloqueos, herramientas repetidas, cambios de incidentes, resultados sin ruta y fallos de consulta.
- **Validación y Corrección Humana:** Se revisó que las expectativas exigieran devolver la geometría del backend, evitar llamadas de IA cuando no hubiera bloqueos y cerrar la sesión en los casos contemplados. También se comprobó que las pruebas verificaran tres consultas en el flujo exitoso y una última respuesta sin herramientas, con un máximo configurado de 400 tokens. Estas pruebas evalúan la coordinación mediante simulaciones, no la integración real con el proveedor. Referencia: commit `07aa3b9`.

## Reloj propio para el escenario

- **Problema abordado:** Evaluar el paso del tiempo dentro de la simulación sin depender exclusivamente de la hora real ni del movimiento del robot.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo incorporar un reloj que permitiera acelerar el escenario y comprobar la activación y el vencimiento de incidentes.
- **Código / Arquitectura generada:** Se creó `useScenarioClock`, con inicio, pausa, multiplicadores ×1, ×10 y ×60 y avance manual. La pantalla pasó a coordinar el reloj con el movimiento, permitiendo también avanzar el escenario con el robot detenido.
- **Validación y Corrección Humana:** Se revisaron los multiplicadores admitidos, el rechazo de avances inválidos y la limpieza del temporizador al abandonar la pantalla. El reloj contabiliza el intervalo pendiente antes de pausar o cambiar la velocidad. La sincronización completa con el movimiento requiere pruebas adicionales. Referencia: commit `198f137`.

## Vigencia de incidentes según la fecha del escenario

- **Problema abordado:** Permitir incidentes programados y vencimientos evaluados con el reloj simulado, diferenciando la fecha de registro del momento en que ocurre el evento.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para incorporar una fecha de inicio y adaptar las consultas de incidentes al tiempo del escenario.
- **Código / Arquitectura generada:** Se agregó `starts_at`, se calculó el vencimiento desde el inicio y se incorporaron los estados programado, activo y finalizado. Las consultas utilizan la condición `inicio ≤ fecha del escenario < vencimiento`.
- **Validación y Corrección Humana:** Se revisaron las condiciones temporales del servicio y la migración que exige un vencimiento posterior al inicio. Para los registros anteriores se asignó su creación como inicio. Las pruebas existentes se adaptaron a los nuevos campos y parámetros, sin que sus respuestas simuladas demuestren la aplicación de las restricciones en PostgreSQL. Referencia: commit `198f137`.

## Catálogo de tipos y efectos de incidentes

- **Problema abordado:** Representar situaciones distintas de un bloqueo genérico y evitar que todos los reportes cerraran automáticamente el paso.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo organizar un catálogo de incidentes con descripciones, duraciones y efectos predeterminados.
- **Código / Arquitectura generada:** Se creó `incident-catalog.ts` y se incorporaron efectos informativos, de precaución y de bloqueo. El registro se amplió con descripción, informante, duración y procedencia, conservando compatibilidad con el botón de prueba existente.
- **Validación y Corrección Humana:** Se revisaron los límites de descripción, informante y duración. La consulta utilizada para calcular desvíos filtra únicamente bloqueos activos, mientras el historial admite todos los efectos. Los valores predeterminados se consideran referencias del simulador. Admitir una procedencia no acredita la identidad de quien reporta. Referencia: commit `198f137`.

## Historial y representación de incidentes por vigencia

- **Problema abordado:** Mostrar los incidentes del escenario sin perder los reportes que todavía no comenzaron o que ya finalizaron.
- **Prompt / Herramienta utilizada:** Se pidió apoyo a ChatGPT para incorporar un historial y actualizar el mapa según la fecha simulada.
- **Código / Arquitectura generada:** Se amplió la consulta con `scenarioTime` e `includeHistory`. El frontend conserva el historial, determina el estado temporal de cada reporte y diferencia los incidentes activos de los bloqueos que afectan al cálculo.
- **Validación y Corrección Humana:** Se revisó que las respuestas pertenecieran a la simulación consultada y que las fechas fueran válidas y estuvieran ordenadas. Se mantuvieron los registros finalizados en el historial y se limitaron las restricciones publicadas a los bloqueos vigentes. Referencia: commit `198f137`.

## Contexto temporal fijo durante la replanificación

- **Problema abordado:** Evitar que las distintas etapas de una evaluación utilizaran fechas diferentes o confundieran el reloj simulado con la hora real.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo transmitir la fecha del escenario al agente y a las herramientas MCP durante toda la evaluación.
- **Código / Arquitectura generada:** Se incorporó `scenarioTime` al contexto compartido, las consultas de incidentes y la respuesta de replanificación. La comprobación final vuelve a consultar los registros utilizando la misma fecha.
- **Validación y Corrección Humana:** Se revisó que el agente y las herramientas recibieran el contexto temporal y que las instrucciones impidieran al modelo sustituirlo por la hora real. Se adaptaron las pruebas relacionadas. En esta versión la fecha todavía era opcional y, si faltaba, se fijaba la hora actual al iniciar la evaluación. Referencia: commit `198f137`.

## Generación de recursos gráficos para incidentes

- **Problema abordado:** Contar con iconos que permitieran reconocer los distintos tipos de incidentes en el mapa y sus referencias.
- **Prompt / Herramienta utilizada:** Se utilizó Gemini para generar y ajustar imágenes de obstáculos, obras, cierres, agua acumulada y otras situaciones representadas en el simulador.
- **Código / Arquitectura generada:** Se obtuvieron recursos gráficos para incorporarlos como archivos locales del frontend y asociarlos con los tipos de incidentes.
- **Validación y Corrección Humana:** Se seleccionaron las imágenes según su claridad y coherencia visual, ajustándolas a su uso como iconos. La asignación de cada imagen se mantuvo separada del efecto del incidente, que determina el backend. Esta entrada agrupa la generación y las actualizaciones de estos recursos, incluida la del commit `040e0cf`, sin requerir una entrada por cada reemplazo de imagen.


## Captura versionada de la red peatonal

- **Problema abordado:** Disponer de caminos peatonales conocidos y estables para calcular recorridos y asociar incidentes a conexiones concretas.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo obtener una red peatonal de Washington desde OpenStreetMap y utilizarla sin consultar el servicio externo en cada operación.
- **Código / Arquitectura generada:** Se agregó un script de descarga mediante Overpass y una captura comprimida con tramos, conexiones, geometrías y atribución. La versión se obtiene a partir del contenido procesado.
- **Validación y Corrección Humana:** Se revisaron los filtros de caminos y accesos, la identificación de nodos compartidos y la división de tramos extensos. Se incorporaron pruebas sobre coordenadas y conectividad. La captura se consideró una representación de los datos importados, sin asumir cobertura completa de todas las veredas. Referencia: commit `ef48728`.

## Cálculo local sobre conexiones conocidas

- **Problema abordado:** Calcular recorridos que respetaran la red del escenario, evitando uniones arbitrarias entre veredas o caminos.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para incorporar un cálculo local por distancia que pudiera excluir tramos bloqueados y admitir retroceso por conexiones existentes.
- **Código / Arquitectura generada:** Se construyó un grafo bidireccional y se incorporó la búsqueda de recorridos sobre sus conexiones. El servicio selecciona este motor cuando recibe una versión de red y devuelve geometría, distancia, duración de referencia e identificadores de tramos utilizados.
- **Validación y Corrección Humana:** Se incorporaron pruebas para cierres de una vereda sin bloquear la opuesta, cruces cerrados, retroceso y puntos demasiado alejados de la red. Se revisó que una versión incompatible fuera rechazada y que un fallo del cálculo local no provocara un cambio automático a OpenRouteService. Referencia: commit `ef48728`.

## Registro de incidentes mediante selección de tramos

- **Problema abordado:** Evitar que un rectángulo general bloqueara simultáneamente caminos cercanos cuando el incidente afectaba una conexión específica.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo registrar el alcance de un incidente mediante identificadores de tramos y recuperar sus geometrías desde el servidor.
- **Código / Arquitectura generada:** Se incorporó la selección de un tramo o una sección de varios tramos y el campo `pedestrian_impact` en PostgreSQL. El backend resuelve los identificadores contra su captura y obtiene los límites necesarios para representar el incidente.
- **Validación y Corrección Humana:** Se revisaron las comprobaciones de versión, existencia de los tramos, ausencia de duplicados, máximo de treinta identificadores y cercanía de hasta 350 metros. Se incorporaron pruebas para rechazar geometrías enviadas en lugar de las del servidor y versiones incompatibles. Referencia: commit `ef48728`.

## Visualización y consulta de la red por zonas

- **Problema abordado:** Mostrar las conexiones seleccionables sin transferir ni dibujar toda la captura en cada vista del mapa.
- **Prompt / Herramienta utilizada:** Se solicitó apoyo a ChatGPT para cargar los tramos visibles y diferenciarlos según fueran veredas, cruces o caminos peatonales.
- **Código / Arquitectura generada:** Se agregó `/api/pedestrian-network`, con metadatos generales y consultas por límites geográficos. El frontend representa los tramos mediante Leaflet y actualiza la consulta al cambiar la vista o el nivel de zoom.
- **Validación y Corrección Humana:** Se revisaron los límites de extensión y cantidad de tramos por respuesta, la validación de los datos recibidos y la limpieza de eventos del mapa. Los nombres cartográficos se presentan mediante `textContent`. Se integró la versión de red en la preparación de la entrega y la simulación. Referencia: commit `ef48728`.

## Restricciones por tramo en la replanificación

- **Problema abordado:** Conseguir que el desvío utilizara las conexiones afectadas por los incidentes, sin convertir su alcance en rectángulos que cerraran otras veredas.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para adaptar las herramientas MCP y enviar al motor local los identificadores de las conexiones bloqueadas.
- **Código / Arquitectura generada:** La sesión distingue los incidentes por tramo de los incidentes por área. Los primeros se traducen a `blockedSegmentIds` y los segundos conservan sus áreas. También se transmite la versión de red y se activa el ajuste estricto del origen.
- **Validación y Corrección Humana:** Se incorporaron pruebas para comprobar el envío de identificadores y evitar que los incidentes por tramo se omitieran en una solicitud al proveedor general. Se revisó el rechazo de impactos pertenecientes a otra versión. Estos controles no sustituyen la validación geométrica completa de la trayectoria. Referencia: commit `ef48728`.

## Migración a Claude y validación de desvíos por tramo

- **Problema abordado:** Adaptar el agente a Claude y corregir la comprobación de alternativas cuando los incidentes afectan tramos de la red peatonal.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo sustituir el cliente de OpenAI por el de Anthropic conservando las herramientas MCP y los controles del backend, y cómo distinguir los bloqueos por tramo de las áreas rectangulares.
- **Código / Arquitectura generada:** Se adaptaron las llamadas al modelo, el intercambio de resultados de herramientas, las variables de entorno y el script `check-ai.ts`. La validación final pasó a comprobar los tramos bloqueados por sus identificadores y a utilizar rectángulos únicamente para incidentes definidos por área.
- **Validación y Corrección Humana:** Se revisó que la consulta de incidentes continuara siendo obligatoria y que el modelo no pudiera cambiar el contexto mediante argumentos. Se ampliaron las pruebas simuladas para respuestas truncadas, herramientas fuera de orden, configuración ausente y conservación de la fecha del escenario. El cálculo y la geometría permanecieron bajo responsabilidad del backend. Referencia: commit `13f3784`.

## Consulta sobre el consumo de memoria de la red peatonal

- **Problema abordado:** Reducir el costo de mantener la captura completa como objetos JavaScript y reconstruir las conexiones durante cada cálculo.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo reorganizar la red para utilizar menos memoria y reutilizar su estructura entre solicitudes.
- **Código / Arquitectura generada:** Se propuso y desarrolló una representación compacta mediante arreglos numéricos y tablas de texto, almacenada en un archivo binario. Los objetos de los tramos se reconstruyen cuando se necesitan para consultas o representación.
- **Validación y Corrección Humana:** Se revisó que el formato conservara versión, identificadores, coordenadas y conectividad. Se mantuvo una interfaz compatible con los consumidores existentes y una comprobación de versión del formato al cargarlo. La reducción efectiva de memoria requiere mediciones y no se deduce únicamente del tamaño del archivo comprimido. Referencia: commit `5d40d29`.

## Implementación de búsqueda A* sobre el grafo compacto

- **Problema abordado:** Evitar recorrer innecesariamente gran parte de la red al buscar una conexión entre origen y destino.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para implementar A* sobre la estructura compacta, conservando las restricciones por tramo y por área.
- **Código / Arquitectura generada:** Se incorporó una cola de prioridad que combina la distancia recorrida con una estimación de distancia al destino. La búsqueda reutiliza el grafo y aplica los bloqueos correspondientes a cada solicitud.
- **Validación y Corrección Humana:** Se revisó la conservación de los extremos, la reconstrucción del recorrido y el tratamiento de conexiones bloqueadas. Se agregó una prueba que realiza una búsqueda con un tramo cerrado y otra sin ese cierre, comprobando que los bloqueos no permanezcan en la siguiente evaluación. Se conservaron los casos existentes de retroceso, cruces y ausencia de conexión. Referencia: commit `5d40d29`.

## Consulta de tramos sin reconstruir toda la red

- **Problema abordado:** Mantener la carga por zonas del mapa sin recuperar todos los tramos como objetos completos.
- **Prompt / Herramienta utilizada:** Se solicitó apoyo a ChatGPT para adaptar las consultas espaciales al nuevo formato y detener la búsqueda cuando se superara la cantidad admitida.
- **Código / Arquitectura generada:** Las consultas pasaron a utilizar el índice espacial del grafo compacto. El endpoint solicita como máximo 12.001 candidatos para detectar si se excede el límite de 12.000 tramos y pedir al usuario que acerque el mapa.
- **Validación y Corrección Humana:** Se revisó que la respuesta mantuviera el contrato utilizado por el frontend y que el límite se aplicara antes de reconstruir un conjunto excesivo de tramos. La selección de incidentes continuó resolviendo identificadores contra la captura del servidor. Referencia: commit `5d40d29`.

## Preparación del archivo de red para ejecución y CI

- **Problema abordado:** Separar la conversión de la captura del trabajo habitual del servidor y disponer del archivo requerido antes de cargar la red.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para crear los comandos de preparación y descompresión e integrarlos en las verificaciones del backend.
- **Código / Arquitectura generada:** Se agregó `prepare-pedestrian-network.ts`, junto con `network:prepare` y `network:unpack`. La preparación genera el binario comprimido y la descompresión utiliza un archivo temporal antes de reemplazar el definitivo. También se incorporó la descompresión en CI y se ajustaron parámetros de memoria del arranque.
- **Validación y Corrección Humana:** Se revisó la separación entre compilación y descompresión, el reemplazo mediante archivo temporal y la comunicación de errores. En este commit la preparación quedó incorporada en CI, sin un `postinstall` que garantizara su ejecución en otros despliegues. Los parámetros de V8 tampoco se consideraron un límite de toda la memoria del proceso. Referencia: commit `5d40d29`.

## Generación reproducible de reportes de la flota

- **Problema abordado:** Incorporar incidentes simulados que representaran actividad de otros robots, combinando reportes sobre el recorrido y en sus alrededores.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo generar reportes con una distribución controlada de 15 % sobre la ruta y 85 % fuera de ella, manteniendo resultados reproducibles.
- **Código / Arquitectura generada:** Se agregó `POST /api/incidents/random` y un generador con semilla. Se reservan quince posiciones sobre el recorrido por cada bloque de cien índices. El tipo y la descripción proceden del catálogo y el informante utiliza un nombre de robot simulado. La generación no realiza llamadas a IA.
- **Validación y Corrección Humana:** Se incorporaron pruebas de distribución y repetibilidad con la misma semilla. Se distinguió la asignación de posiciones del resultado efectivo, porque una generación puede omitirse si no existe una ubicación adecuada. Los reportes conservan la fecha del escenario recibida. Referencia: commit `c1d8813`.

## Selección de ubicaciones sobre tramos existentes

- **Problema abordado:** Evitar incidentes en coordenadas arbitrarias, sobre tramos ya ocupados o confundidos con la vereda opuesta.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para seleccionar conexiones cercanas de la red y distinguir cuáles coinciden con el recorrido pendiente.
- **Código / Arquitectura generada:** Se consultan tramos hasta 1,2 km de la posición inicial recibida y se excluyen los ocupados por incidentes activos. La comparación utiliza superposición longitudinal y un índice espacial. También se aplican separaciones mínimas respecto del robot y del destino.
- **Validación y Corrección Humana:** Se incorporaron pruebas sobre veredas opuestas, contactos de esquina, recorrido ya transitado y tramos ocupados. Cuando no hay candidatos se devuelve `skipped`, sin inventar una ubicación. Se revisaron los límites de coordenadas y separación entre puntos, reconociendo que esos controles no demuestran por sí solos la procedencia del recorrido enviado. Referencia: commit `c1d8813`.

## Identificadores estables para recuperar reportes al reintentar

- **Problema abordado:** Recuperar un reporte cuando se pierde la respuesta después de guardarlo, evitando crear otro evento para el mismo intento.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo identificar cada generación de forma estable y diferenciar eventos pertenecientes a distintas simulaciones.
- **Código / Arquitectura generada:** El identificador se deriva de la simulación, la generación y el índice del evento. Antes de crear el incidente se consulta si ya existe. El servicio de registro admite ese identificador y conserva el registro ante un conflicto.
- **Validación y Corrección Humana:** Se incorporaron pruebas para recuperar eventos existentes y obtener identificadores distintos entre eventos y simulaciones. Se revisó que una versión de red incompatible se rechazara antes de generar el reporte. Esta implementación evita duplicados por ID, pero todavía no compara el contenido completo de un reintento con el registro existente. Referencia: commit `c1d8813`.


## Integración de reportes automáticos con el escenario

- **Problema abordado:** Incorporar los incidentes generados por la flota al mapa y al historial, respetando el reloj simulado y las operaciones en curso.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo conectar el generador del backend con la simulación y procesar los reportes sin enviar solicitudes simultáneas.
- **Código / Arquitectura generada:** Se agregó `RandomFleetReports`, que solicita los eventos al alcanzar su fecha programada. La generación espera durante la edición y otras operaciones que bloquean los controles. Los incidentes recibidos se integran al estado compartido mediante su identificador.
- **Validación y Corrección Humana:** Se revisó que la respuesta incluyera un incidente válido de la simulación actual y que se distinguieran los resultados `created` y `skipped`. La combinación por ID evita duplicar entradas en el estado local y permite conservar reportes recibidos durante una actualización del historial. Referencia: commit `0fc39c0`.

## Notificaciones de la flota simulada

- **Problema abordado:** Comunicar la aparición de incidentes sin exigir que el usuario revise continuamente el historial.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para mostrar avisos breves con el robot informante, el tipo de incidente y su ubicación aproximada.
- **Código / Arquitectura generada:** Se incorporó una notificación emergente con cierre manual y duración de ocho segundos reales, junto con una lista de los ocho reportes más recientes. Se muestran el efecto y la relación con el recorrido al momento de generar el reporte.
- **Validación y Corrección Humana:** Se revisó que los mensajes identificaran a la flota como simulada y la ubicación como aproximada. Se incluyeron anuncios de estado mediante `aria-live="polite"` y limpieza del temporizador. La lista reciente se mantuvo separada del historial completo de incidentes. Referencia: commit `0fc39c0`.

## Conservación del contexto al reintentar reportes

- **Problema abordado:** Evitar que un reintento cambiara los datos del evento después de un error de conexión o una respuesta perdida.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo conservar la solicitud original y detener los reintentos automáticos cuando se produce un fallo.
- **Código / Arquitectura generada:** Se conserva el cuerpo enviado, incluidos generación, índice, fecha y coordenadas. Ante un error se ofrece un reintento manual. También se cancela la solicitud al desmontar el componente y se descartan respuestas canceladas.
- **Validación y Corrección Humana:** Se revisó que el índice avanzara únicamente después de recibir un reporte creado y que un resultado omitido programara otro intervalo sin consumirlo. El reintento reutiliza el mismo cuerpo, apoyándose en los identificadores estables del backend. Esto no resuelve por sí solo la coherencia entre la fecha y el recorrido de eventos atrasados. Referencia: commit `0fc39c0`.

## Catálogo de modelos de robots

- **Problema abordado:** Consultar y registrar perfiles operativos que pudieran utilizarse al incorporar distintas unidades de robot.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo exponer un catálogo de modelos con capacidades, dimensiones y procedencia de los datos.
- **Código / Arquitectura generada:** Se agregaron los endpoints `GET /api/robot-models` y `POST /api/robot-models`, con validación mediante Zod y consultas parametrizadas. Los campos opcionales desconocidos se normalizan a `null`.
- **Validación y Corrección Humana:** Se revisaron los valores positivos para velocidad, batería, consumo y dimensiones conocidas. Se distinguió un margen de cero de uno desconocido y se exigieron notas para perfiles declarados como medidos o documentados. Esta versión todavía no incorpora los máximos operativos definidos posteriormente en la auditoría. Referencia: commit `0c977f7`.

## Registro de unidades asociadas a un modelo

- **Problema abordado:** Evitar que cada unidad duplicara sus capacidades o permitiera sobrescribir las del modelo seleccionado.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para adaptar la API de robots al registro mediante nombre y `modelId`, recuperando las capacidades desde el modelo almacenado.
- **Código / Arquitectura generada:** El registro pasó a utilizar un esquema estricto y una operación `INSERT ... SELECT` que requiere la existencia del modelo. Las consultas devuelven los datos de la unidad junto con las características de su modelo.
- **Validación y Corrección Humana:** Se revisó que el cliente no pudiera enviar capacidades adicionales y que un modelo inexistente produjera `404` sin insertar la unidad. Se conservaron respuestas controladas para duplicados y fallos internos. Referencia: commit `0c977f7`.

## Pruebas de los contratos de modelos y unidades

- **Problema abordado:** Comprobar el nuevo registro por modelo y evitar que solicitudes inválidas llegaran a la base.
- **Prompt / Herramienta utilizada:** Se solicitó apoyo a ChatGPT para definir pruebas de los endpoints, incluyendo datos desconocidos, campos adicionales y errores de persistencia.
- **Código / Arquitectura generada:** Se incorporaron pruebas con Supertest y Vitest y se actualizaron las de robots. Cubren consultas, altas, medidas opcionales, procedencia, modelos inexistentes, duplicados y errores internos.
- **Validación y Corrección Humana:** Se revisó que las expectativas comprobaran los parámetros enviados al SQL, el rechazo de capacidades en el registro de unidades y la ausencia de detalles privados en las respuestas de error. Las pruebas simulan el pool y no demuestran la ejecución de las consultas ni las restricciones en PostgreSQL real. Referencia: commit `0c977f7`.

## Consulta sobre la selección de modelos y sus capacidades

- **Problema abordado:** Adaptar la preparación del robot al catálogo de modelos, evitando pedir las mismas capacidades al registrar cada unidad.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo organizar la interfaz para seleccionar un modelo, mostrar sus características y permitir agregar nuevas configuraciones al catálogo.
- **Código / Arquitectura generada:** Se propuso separar el formulario de modelos del registro de unidades y presentar un resumen de las capacidades del modelo elegido.
- **Validación y Corrección Humana:** Se adoptó el registro de unidades mediante nombre y modelo. Se mantuvieron visibles las medidas desconocidas como “Sin información” y se distinguieron los perfiles simulados de los documentados o medidos. El ancho requerido se presentó como una referencia geométrica, sin afirmar que certificara el paso. Referencia: commit `d493425`.

## Implementación de formularios y validación de respuestas

- **Problema abordado:** Conectar el nuevo flujo con la API y comprobar los datos antes de incorporarlos al estado de la aplicación.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para implementar `RobotModelForm`, actualizar `RobotSetupSection` y preparar validadores y pruebas de los perfiles recibidos.
- **Código / Arquitectura generada:** Se incorporaron la consulta del catálogo, el alta de modelos, el registro de unidades por `modelId` y los mensajes de carga, error y confirmación. Se agregaron validadores y el cálculo `ancho + 2 × margen lateral`.
- **Validación y Corrección Humana:** Se revisó que las respuestas se comprobaran antes de utilizarlas y que el registro de unidades no enviara capacidades independientes. Se incorporaron pruebas de medidas inválidas, valores desconocidos y margen cero. El cálculo del ancho devuelve `null` cuando falta información o el resultado no es finito. Las pruebas no verifican por sí solas el funcionamiento completo de los formularios en navegador. Referencia: commit `d493425`.

## Consulta de superficies peatonales de Washington

- **Problema abordado:** Obtener polígonos que representaran el espacio peatonal disponible, complementando las líneas utilizadas por el grafo.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo incorporar superficies de DC GIS y distinguir la capa actual de la captura histórica de 2023.
- **Código / Arquitectura generada:** Se agregó `queryWalkSurfaces()` para consultar ambas fuentes por zona. Las solicitudes piden GeoJSON en coordenadas geográficas y el servicio convierte los polígonos a una representación común `MultiPolygon`.
- **Validación y Corrección Humana:** Se revisaron los identificadores de las capas, los parámetros de consulta y la conservación de identificadores y categorías. Se incorporaron pruebas con respuestas simuladas para comprobar la fuente seleccionada y el sistema de coordenadas solicitado. Este commit incorpora la consulta, no determina por sí solo la transitabilidad de cada superficie. Referencia: commit `cba340f`.

## Control de cobertura y respuestas incompletas

- **Problema abordado:** Evitar que el cálculo utilizara cartografía inválida, truncada o correspondiente a consultas demasiado extensas.
- **Prompt / Herramienta utilizada:** Se pidió orientación a ChatGPT sobre qué comprobaciones aplicar antes de aceptar las superficies de un proveedor externo.
- **Código / Arquitectura generada:** Se limitaron la zona consultable, la cantidad de superficies, el tamaño de respuesta y el número de vértices. También se incorporaron comprobaciones de estructura, coordenadas y señales de truncamiento del proveedor.
- **Validación y Corrección Humana:** Se agregaron pruebas para rechazar vistas amplias antes de descargar, respuestas truncadas y fallos de conexión. Se mantuvo el rechazo ante indisponibilidad, sin fabricar veredas. Los controles de tamaño y vértices se aplican después de cargar o procesar los datos, por lo que todavía no evitan todo el consumo previo de memoria. Referencia: commit `cba340f`.

## Reutilización de consultas cartográficas

- **Problema abordado:** Reducir consultas repetidas al proveedor cuando se solicita una misma zona o áreas cercanas.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo incorporar una caché acotada sin mezclar superficies actuales con las históricas.
- **Código / Arquitectura generada:** Los límites se ajustan a una cuadrícula y se utilizan como clave junto con la fuente. La caché conserva hasta ocho consultas durante cinco minutos.
- **Validación y Corrección Humana:** Se incorporó una prueba que solicita ambas fuentes y repite la consulta actual, comprobando que reutilice su resultado sin devolver el histórico. Esta versión almacena resultados completos, pero todavía no comparte solicitudes simultáneas pendientes. Referencia: commit `cba340f`.

## Evaluación del espacio disponible según el robot

- **Problema abordado:** Determinar si un obstáculo ocupa todo el paso disponible o si un robot puede rodearlo dentro de la superficie peatonal.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo representar el espacio necesario para el robot a partir de su ancho y margen lateral.
- **Código / Arquitectura generada:** Se incorporó `makeConstraint()`, que reduce el espacio utilizable junto a los bordes y amplía los obstáculos según el radio del robot, con tolerancias geométricas adicionales.
- **Validación y Corrección Humana:** Se incorporaron pruebas con un mismo obstáculo para un robot estrecho y otro ancho. También se contemplaron obstáculos que cierran conjuntamente el paso. La evaluación depende de la geometría y las dimensiones recibidas, sin constituir una certificación de seguridad física. Referencia: commit `8b69556`.

## Operaciones sobre superficies y obstáculos

- **Problema abordado:** Combinar superficies, recortar áreas afectadas y conservar los huecos que no pueden utilizarse para circular.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para implementar operaciones de unión, intersección, diferencia y ampliación de polígonos.
- **Código / Arquitectura generada:** Se agregaron utilidades basadas en `clipper-lib`, utilizando coordenadas locales en metros para realizar las operaciones y reconstruir las geometrías resultantes.
- **Validación y Corrección Humana:** Se incorporaron pruebas de recorte del incidente a la vereda, conservación de huecos y unión de superficies contiguas. También se incluyó un caso que rechaza conectar superficies separadas por un espacio sin cartografiar. Referencia: commit `8b69556`.

## Búsqueda de maniobras alrededor de obstáculos

- **Problema abordado:** Adaptar la parte afectada de un recorrido sin descartar toda una conexión cuando todavía existe un paso lateral.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo buscar una trayectoria dentro del espacio libre y unirla con el recorrido existente.
- **Código / Arquitectura generada:** Se incorporaron `adaptLine()` y `connectOnSurface()`. El motor identifica accesos sobre el recorrido y busca conexiones mediante A*, ampliando progresivamente el área explorada. La adaptación conserva los extremos originales y comprueba nuevamente el contacto con obstáculos.
- **Validación y Corrección Humana:** Se agregaron pruebas de paso lateral, obstáculos alternados y conservación de extremos. También se comprobó mediante casos sintéticos que no se aceptaran conexiones cuando el recorrido queda fuera de las superficies disponibles. Estas pruebas no garantizan resolver todas las configuraciones posibles. Referencia: commit `8b69556`.

## Distinción entre bloqueo y resultado no verificado

- **Problema abordado:** Evitar que una búsqueda limitada o una falta de coincidencia cartográfica se informara como imposibilidad física de paso.
- **Prompt / Herramienta utilizada:** Se pidió orientación a ChatGPT para diferenciar un espacio libre desconectado de una maniobra que no pudo comprobarse.
- **Código / Arquitectura generada:** Se incorporó `SurfaceGeometryError` con estados `blocked` y `unknown`. La búsqueda local dispone de 500 ms, hasta 350 candidatos y accesos a no más de 25 metros del obstáculo.
- **Validación y Corrección Humana:** Se revisó que agotar tiempo o candidatos produjera un resultado no verificado, sin afirmar que la vereda estuviera físicamente bloqueada. Los límites corresponden a partes de la búsqueda y no garantizan que toda la evaluación termine en 500 ms. Referencia: commit `8b69556`.


## Preparación del contexto de superficies por simulación

- **Problema abordado:** La evaluación del espacio disponible necesita conocer qué robot participa en la simulación, sus dimensiones y la versión de la red utilizada.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo conservar ese contexto en el backend y evitar depender de dimensiones enviadas libremente desde el navegador.
- **Código / Arquitectura generada:** Se incorporó `surface_scenarios` para asociar simulación, robot y versión de red. El servidor recupera el ancho y el margen lateral desde el modelo almacenado y los conserva para el escenario.
- **Validación y Corrección Humana:** Se incluyeron comprobaciones de existencia del robot y compatibilidad de red. El registro de un contexto existente comprueba que conserve el mismo robot y versión. Referencia: commit `fba26ac`.

## Ubicación de incidentes según la cartografía disponible

- **Problema abordado:** Un clic sobre el mapa no identifica por sí solo el área peatonal afectada. La ubicación necesita considerar la orientación de la vereda, sus límites y los posibles huecos.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo convertir una posición seleccionada en una propuesta de ubicación apoyada en la cartografía conocida.
- **Código / Arquitectura generada:** Se incorporó un servicio de ubicación que utiliza superficies disponibles para proponer el área afectada. En esta etapa también contempla recurrir a un tramo conocido cuando falta el polígono correspondiente.
- **Validación y Corrección Humana:** Se agregaron pruebas para veredas diagonales, clics descentrados, huecos interiores y ausencia de conexiones cercanas. También se distingue una consulta cartográfica fallida de una respuesta sin superficies. Referencia: commit `fba26ac`.

## Vista previa del área afectada antes del guardado

- **Problema abordado:** Guardar directamente el rectángulo dibujado puede incluir espacios ajenos a las superficies peatonales o afectar más de una superficie sin que el usuario lo advierta.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para estructurar una vista previa que recortara la selección sobre las superficies admitidas antes de registrar el incidente.
- **Código / Arquitectura generada:** El backend intersecta el rectángulo con la cartografía peatonal, conserva las partes afectadas y prepara la geometría utilizada para evaluar colisiones. Cuando la selección alcanza varias superficies, el guardado exige una confirmación explícita.
- **Validación y Corrección Humana:** Se incorporaron controles de dimensiones, coordenadas, cantidad de superficies y complejidad geométrica. Las selecciones sin una intersección útil se rechazan. Estos controles validan la selección respecto de la cartografía disponible, sin demostrar su correspondencia física exacta. Referencia: commit `fba26ac`.

## Persistencia conjunta del incidente y su geometría

- **Problema abordado:** El reporte y su geometría se almacenan en estructuras diferentes. Una escritura parcial puede dejar un incidente sin la información necesaria para representarlo o evaluarlo.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo guardar ambos registros mediante una transacción y tratar los reintentos de una solicitud.
- **Código / Arquitectura generada:** Se incorporó `incident_surfaces`, relacionada con `incidents`. La operación de guardado utiliza una transacción y, ante un identificador existente, comprueba determinados datos del reporte antes de aceptar el reintento.
- **Validación y Corrección Humana:** Se revisaron la confirmación y reversión de la transacción, junto con la comparación de simulación, descripción, fechas, efecto y selección. La comprobación del conflicto todavía no equivale a comparar toda la geometría. Su funcionamiento real requiere verificación con PostgreSQL. Referencia: commit `fba26ac`.

## Prioridad del paso lateral sobre el recorrido vigente

- **Problema abordado:** Un obstáculo sobre una vereda no siempre requiere abandonar el recorrido y buscar un desvío completo. Puede existir espacio suficiente para rodearlo dentro de las superficies conocidas.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre la posibilidad de intentar primero una adaptación local del recorrido y recurrir después a otra búsqueda en el grafo.
- **Código / Arquitectura generada:** Se incorporó un servicio que intenta adaptar el recorrido preferido considerando superficies, obstáculos y dimensiones del robot. Si esa adaptación no resulta viable, puede solicitar otra ruta y descartar conexiones que no permitan el paso.
- **Validación y Corrección Humana:** Se agregaron pruebas de conservación de extremos, adaptación alrededor de obstáculos y búsqueda alternativa para un robot demasiado ancho. También se contempla la conexión entre superficies contiguas. La primera alternativa válida no se presenta como garantía del desvío más corto. Referencia: commit `fba26ac`.

## Compatibilidad entre superficies y restricciones anteriores

- **Problema abordado:** La incorporación de incidentes sobre superficies debía convivir con los bloqueos existentes por áreas y tramos, sin convertir automáticamente cualquier incidencia en el cierre completo de una vereda.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo integrar los mecanismos anteriores con la nueva evaluación geométrica y qué información debía recibir el agente de replanificación.
- **Código / Arquitectura generada:** Se añadieron adaptadores para incorporar restricciones anteriores al cálculo sobre superficies. El agente recibe resúmenes de incidentes, mientras las geometrías y la comprobación del paso permanecen en los servicios del backend.
- **Validación y Corrección Humana:** Se incorporaron pruebas para comprobar que un rectángulo no cierre toda la vereda, que un tramo afecte su sección correspondiente y que permanezcan disponibles superficies separadas. También se comprueba que las precauciones no se conviertan automáticamente en bloqueos. Referencia: commit `fba26ac`.

## Conservación de los extremos efectivos al replanificar

- **Problema abordado:** El destino aceptado por el cálculo puede diferir del clic original. Reutilizar ese clic al solicitar un desvío puede producir una incompatibilidad con el recorrido que ya estaba siguiendo el robot.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre qué posición inicial y destino conservar al construir una nueva solicitud de replanificación.
- **Código / Arquitectura generada:** Se añadió una utilidad para obtener el origen desde la posición actual del robot y el destino desde la última coordenada del recorrido aceptado. También comprueba la validez de las coordenadas.
- **Validación y Corrección Humana:** Se incorporaron pruebas que reproducen el problema de reenviar el destino original y comprueban la conservación del destino aceptado y de la posición actual. La incorporación de la utilidad debe distinguirse de su integración completa en todos los consumidores de la interfaz. Referencia: commit `fba26ac`.


## Editor visual de incidentes sobre el mapa

- **Problema abordado:** Registrar un incidente sobre una superficie requiere ajustar su posición, tamaño y orientación, en lugar de depender únicamente de un punto seleccionado.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo diseñar un editor con Leaflet que permita manipular el área afectada directamente sobre el mapa.
- **Código / Arquitectura generada:** Se incorporaron `SurfaceIncidentEditor` para el formulario y la coordinación de solicitudes, e `incident-map-editor.ts` para las capas y controles cartográficos. El área dispone de un control central para moverla, esquinas para redimensionarla y un control de rotación.
- **Validación y Corrección Humana:** Se revisaron los límites de tamaño y la distinción entre arrastrar el mapa y seleccionar una ubicación. También se incluyó la retirada de controles, eventos y capas al cerrar el editor. Referencia: commit `96aa080`.

## Vista previa vinculada con la selección vigente

- **Problema abordado:** Los ajustes sucesivos pueden generar varias consultas y hacer que una respuesta anterior se muestre sobre una selección nueva.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para coordinar las consultas de ubicación y vista previa sin aplicar resultados que hubieran quedado desactualizados.
- **Código / Arquitectura generada:** La ubicación utiliza cancelación y un número de operación. La vista previa espera 350 milisegundos antes de consultar y queda asociada a los datos enviados. El mapa representa el área afectada, el espacio libre y la maniobra local devueltos por el backend.
- **Validación y Corrección Humana:** Se incorporaron comprobaciones de estructura para las respuestas y controles para descartar operaciones canceladas. Una vista previa de otra selección no habilita su confirmación. El navegador representa el análisis recibido, mientras el backend conserva el cálculo geométrico. Referencia: commit `96aa080`.

## Confirmación y cancelación de la ubicación

- **Problema abordado:** Modificar provisionalmente una ubicación no debería reemplazar de inmediato una selección ya confirmada ni permitir guardar mientras el ajuste está incompleto.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo separar la edición provisional, la confirmación de ubicación y el guardado definitivo del reporte.
- **Código / Arquitectura generada:** Se añadieron estados de edición y confirmación, junto con una copia de la selección anterior. Confirmar finaliza la edición y desplaza la pantalla al formulario. Cancelar restaura la ubicación previa. Las selecciones sobre varias superficies requieren una confirmación adicional antes del guardado.
- **Validación y Corrección Humana:** Se revisaron las condiciones que habilitan confirmar y guardar. Cambiar el área invalida su confirmación y exige una vista previa correspondiente. El desplazamiento al formulario no resuelve por sí solo el traslado del foco, que requiere revisión de accesibilidad. Referencia: commit `96aa080`.

## Formulario de reportes y reintentos de guardado

- **Problema abordado:** El editor necesita completar los datos del incidente, impedir envíos simultáneos y conservar el reporte cuando falla la respuesta o la actualización posterior del mapa.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo conectar el catálogo con el formulario y conservar una solicitud estable para sus reintentos.
- **Código / Arquitectura generada:** El formulario carga tipos y valores predeterminados, permite elegir efecto, descripción y duración, y prepara el cuerpo del reporte. Si los datos no cambian, el reintento conserva identificador, fechas y contenido. También distingue un guardado seguido de un fallo de actualización.
- **Validación y Corrección Humana:** Se incorporaron controles de duración, descripción, selección y envío pendiente. La ausencia de duplicados depende además del backend. En esta versión todavía no se valida el contenido de las confirmaciones de contexto y guardado. Referencia: commit `96aa080`.

## Referencias cartográficas y explicación de sus límites

- **Problema abordado:** El usuario necesita distinguir la superficie disponible, el área seleccionada y las limitaciones de la cartografía antes de registrar un incidente.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo presentar capas y mensajes que ayuden a revisar la ubicación sin atribuirles garantías que el sistema no ofrece.
- **Código / Arquitectura generada:** Se incorporaron superficies por zona visible y fotografías aéreas de DC GIS de 2023 y 2025. Las escaleras y veredas ocultas se diferencian visualmente. En esta etapa también se informa cuando la ubicación utiliza tramos completos y no permite evaluar paso lateral.
- **Validación y Corrección Humana:** Se revisaron los mensajes de efectos y alcance geométrico, aclarando que no se comprueban longitud del robot, radio de giro, pendiente ni condiciones actuales. Se añadieron estilos adaptables y mensajes de estado, aunque este commit no incorpora pruebas automatizadas nuevas ni acredita una revisión visual o de accesibilidad completa. Referencia: commit `96aa080`.


## Separación del flujo de replanificación de la página de simulación

- **Problema abordado:** `SimulationPage` concentraba la presentación, las solicitudes y la coordinación de la replanificación, lo que dificultaba revisar y probar ese comportamiento por separado.
- **Prompt / Herramienta utilizada:** Consulta puntual a ChatGPT sobre cómo distribuir esas responsabilidades sin modificar el funcionamiento esperado de la simulación.
- **Código / Arquitectura generada:** La ayuda se centró en orientar la separación entre un controlador independiente de React, un hook de integración y módulos de solicitudes y validación de respuestas. También se reunieron los contratos de rutas en un archivo compartido.
- **Validación y Corrección Humana:** Se incorporaron pruebas con respuestas HTTP simuladas para comprobar la pausa previa, el envío de la posición y el recorrido pendientes, la prevención de solicitudes simultáneas y el descarte de respuestas canceladas. También se contemplaron rutas de otra red, coordenadas inválidas y alternativas rechazadas por falta de continuidad. Estas pruebas no sustituyen la comprobación completa en navegador. Referencia: commit `cc24449`.

## Separación entre la configuración de Express y el arranque del servidor

- **Problema abordado:** `index.ts` reunía la configuración de Express y la apertura del puerto, lo que dificultaba reutilizar la aplicación en pruebas sin ejecutar el arranque habitual.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo separar ambas responsabilidades y probar la configuración HTTP mediante Supertest.
- **Código / Arquitectura generada:** Se incorporó `createApp()` en `app.ts` para configurar el lector JSON, las rutas y el endpoint de salud. `index.ts` quedó encargado de cargar las variables de entorno, crear la aplicación e iniciar la escucha.
- **Validación y Corrección Humana:** Se añadieron pruebas con routers simulados para comprobar la respuesta de salud, el orden de los flujos de replanificación y el rechazo de cuerpos superiores a 1 MB antes de alcanzar esos routers. Estas pruebas verifican la composición HTTP, sin consultar PostgreSQL, cartografía ni IA. Referencia: commit `dbdd701`.

## Separación del contexto del escenario y su persistencia

- **Problema abordado:** `surface-incidents.ts` reunía el registro de incidentes con las consultas y reglas del contexto del escenario, dificultando revisar esas responsabilidades por separado.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo extraer el contexto a módulos propios sin modificar el comportamiento ni romper sus consumidores.
- **Código / Arquitectura generada:** Se separaron las consultas SQL en `repositories/surface-context.ts`, las reglas en `services/surface-context.ts` y las estructuras en `types/surfaces.ts`. Se conservaron temporalmente las exportaciones anteriores para mantener la compatibilidad.
- **Validación y Corrección Humana:** Se incorporaron pruebas para versiones incompatibles, robots inexistentes, asociaciones distintas y fallos de persistencia. Las pruebas simulan la base y no acreditan la ejecución del SQL en PostgreSQL. Referencia: commit `50c3bc6`.

## Conservación de las dimensiones utilizadas por cada escenario

- **Problema abordado:** Mantener una evaluación coherente requiere utilizar las dimensiones con las que se preparó el escenario, sin sustituirlas automáticamente por cambios posteriores del catálogo.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo conservar esa copia y comprobar las medidas necesarias para evaluar el paso.
- **Código / Arquitectura generada:** La extracción mantuvo la lectura de dimensiones desde el modelo almacenado y la conservación del contexto original al repetir el registro. También centralizó `robotRadius()`, que calcula medio ancho más margen lateral.
- **Validación y Corrección Humana:** Se añadieron casos para dimensiones desconocidas, negativas y no finitas, junto con un margen explícito de cero. Se mantuvo la diferencia entre cero y ausencia de información. Estas reglas ya existían y el commit las separa y amplía sus pruebas, sin introducir una validación nueva del resultado aritmético combinado. Referencia: commit `50c3bc6`.

## Extracción del guardado transaccional a un repositorio

- **Problema abordado:** El servicio de incidentes sobre superficies reunía la preparación del reporte con las consultas SQL y la administración de la transacción.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo separar la persistencia sin perder el guardado conjunto del incidente y su geometría.
- **Código / Arquitectura generada:** Se incorporó `repositories/surface-reports.ts` y el contrato `SurfaceReportToInsert`. El servicio prepara fechas, efecto y límites, mientras el repositorio administra ambas escrituras mediante una misma conexión y transacción.
- **Validación y Corrección Humana:** Se añadieron pruebas con un cliente PostgreSQL simulado para comprobar el orden de las escrituras, la confirmación conjunta y los reintentos. Se conserva la comparación de los campos previstos y de la selección para detectar conflictos, sin incorporar una comparación completa de toda la geometría. Referencia: commit `12c9d28`.

## Conservación del error original y descarte de conexiones con fallos

- **Problema abordado:** Si una escritura falla y también falla su reversión, el segundo error puede ocultar la causa original y la conexión puede regresar al pool en un estado inadecuado.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para revisar el tratamiento de errores de la transacción y la liberación de la conexión.
- **Código / Arquitectura generada:** Se protegió el `ROLLBACK` con un manejo independiente. La operación conserva el error original y, cuando falla la reversión, descarta la conexión mediante `release(error)`. Los conflictos de reporte se traducen desde el servicio a una respuesta `409`.
- **Validación y Corrección Humana:** Se incorporaron pruebas de fallos al iniciar, insertar y confirmar, además de reversión fallida y conexión no disponible. Las expectativas comprueban que se preserve el error original y se libere o descarte el cliente según corresponda. Son pruebas simuladas y no sustituyen la verificación con PostgreSQL real. Referencia: commit `12c9d28`.

## Verificación de recorridos propuestos por el navegador

- **Problema abordado:** Recibir coordenadas válidas no demuestra que el recorrido pertenezca a la red peatonal o permanezca dentro de superficies conocidas.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo comprobar la continuidad cartográfica de un recorrido antes de utilizarlo como propuesta para la replanificación.
- **Código / Arquitectura generada:** Se incorporó `hasPedestrianPathProof()`. Cada parte del recorrido debe permanecer en una superficie compatible con el ancho del robot o coincidir con una conexión conocida del grafo. La comprobación contempla los intervalos completos, no únicamente sus extremos.
- **Validación y Corrección Humana:** Se añadieron pruebas de trayectorias inventadas, superficies demasiado angostas y recorridos cuyos extremos son válidos pero atraviesan un hueco. Esta comprobación acredita correspondencia cartográfica, mientras la evaluación de obstáculos continúa en el motor de superficies. Referencia: commit `2e38b32`.

## Continuidad entre conexiones del grafo

- **Problema abordado:** Dos líneas pueden cruzarse o coincidir visualmente sin representar una conexión por la que el robot pueda pasar.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo distinguir una conexión real del grafo de una intersección puramente geométrica.
- **Código / Arquitectura generada:** La verificación conserva los nodos originales y asigna identificadores propios a los vértices intermedios. Fuera de las superficies admitidas, una transición entre aristas requiere un nodo compartido y proximidad a ese nodo.
- **Validación y Corrección Humana:** Se incorporaron casos que permiten giros entre aristas conectadas y rechazan saltos entre ejes que se cruzan sin compartir nodo. La tolerancia de cinco centímetros se utiliza para reconocer coincidencias numéricas, sin considerarla un ancho supuesto de vereda. Referencia: commit `2e38b32`.

## Uso condicionado del recorrido preferido

- **Problema abordado:** Era necesario conservar una maniobra válida ya disponible sin aceptar automáticamente cualquier trayectoria enviada por el cliente.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para integrar la verificación del recorrido preferido y mantener una alternativa de cálculo cuando no pudiera comprobarse.
- **Código / Arquitectura generada:** El recorrido propuesto se entrega al núcleo únicamente si supera la comprobación cartográfica. Si no la supera, se descarta esa propuesta y se utiliza el cálculo habitual del servidor.
- **Validación y Corrección Humana:** Se añadieron pruebas que descartan un rodeo inventado y obtienen una maniobra dentro de la vereda. Otro caso conserva una propuesta válida sin solicitar una ruta nueva al grafo. Descartar la propuesta no se interpreta como prueba de bloqueo físico. Referencia: commit `2e38b32`.

## Recuperación de desvíos mediante retroceso

- **Problema abordado:** Un obstáculo puede provocar que el grafo descarte un tramo completo aunque el robot todavía pueda retroceder por su parte libre hasta un cruce.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo recuperar esa posibilidad sin conectar arbitrariamente al robot con otra vereda.
- **Código / Arquitectura generada:** Se incorporó `recoverSurfaceRoute()`. Busca conexiones desde el origen y el destino hacia los extremos de sus tramos, siguiendo geometrías del servidor. Después calcula el recorrido intermedio y reconstruye la trayectoria completa.
- **Validación y Corrección Humana:** Se añadieron pruebas de retroceso hasta un cruce, conservación de ambos extremos y rechazo de veredas desconectadas. También se comprueba que la recuperación no habilite un tramo cerrado explícitamente por su identificador. Referencia: commit `2e38b32`.

## Comprobación de seguridad de las conexiones recuperadas

- **Problema abordado:** Recuperar una conexión no resulta válido si la retirada, la llegada o la unión final atraviesan otro obstáculo.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT qué comprobaciones aplicar a los conectores y al recorrido completo antes de aceptar la recuperación.
- **Código / Arquitectura generada:** Se comprueban los conectores frente a las áreas de peligro, incluidos contactos con sus bordes. La ruta intermedia debe conservar la versión de red y conectar con los extremos solicitados. La trayectoria reconstruida vuelve a comprobarse y sus métricas se recalculan.
- **Validación y Corrección Humana:** Se incorporaron casos que rechazan una retirada atravesada por otro obstáculo y un origen situado dentro de su margen. Estas comprobaciones se añadieron al flujo de recuperación, sin representar todavía una unificación de todos los criterios de contacto del motor. Referencia: commit `2e38b32`.

## Separación del núcleo de cálculo y control de los intentos de recuperación

- **Problema abordado:** Añadir recuperación al mismo módulo podía dificultar su revisión y provocar llamadas recursivas o intentos innecesarios ante errores ajenos al cálculo.
- **Prompt / Herramienta utilizada:** Se pidió orientación a ChatGPT para separar el núcleo existente de la coordinación de verificación y recuperación.
- **Código / Arquitectura generada:** El cálculo anterior se trasladó a `surface-routing-core.ts`, conservando las exportaciones utilizadas por otros módulos. La entrada coordinadora intenta recuperar únicamente errores `422`. Se acotaron las conexiones candidatas y su longitud, y la recuperación llama directamente al núcleo para evitar otra recuperación recursiva.
- **Validación y Corrección Humana:** Se revisó que los demás errores se propagaran y que, si no hubiera recuperación, se conservara el error original. Los límites son parciales y no constituyen un presupuesto global de toda la evaluación. Las pruebas incorporadas utilizan escenarios sintéticos y dependencias simuladas, sin acreditar el funcionamiento completo en el despliegue. Referencia: commit `2e38b32`.


## Representación explícita del alcance de las restricciones

- **Problema abordado:** Los incidentes por área, tramo y superficie utilizaban estructuras que podían confundirse. Una superficie podía conservar identificadores de tramos cercanos sin que eso significara el cierre completo de esas conexiones.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo distinguir estos alcances sin utilizar listas vacías ni interpretar indirectamente otros campos.
- **Código / Arquitectura generada:** Se incorporó `RoutingRestriction` con las variantes `area`, `segments` y `surface`. Un servicio transforma los incidentes en restricciones explícitas y conserva sus metadatos, dejando las geometrías de superficie en el backend.
- **Validación y Corrección Humana:** Se añadieron pruebas para distinguir las tres variantes, rechazar cierres por tramo sin identificadores y comprobar que las precauciones y los avisos no se conviertan en bloqueos. Referencia: commit `5d10306`.

## Construcción de restricciones según el motor correspondiente

- **Problema abordado:** Traducir todos los incidentes a rectángulos o cierres completos podía impedir un paso lateral válido o bloquear una vereda que no estaba afectada.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo preparar una solicitud que conservara el significado de cada restricción durante la coordinación mediante MCP.
- **Código / Arquitectura generada:** Se centralizó la construcción de solicitudes. Las áreas se envían como `blockedAreas`, los cierres por tramo como `blockedSegmentIds` y las superficies como referencias `surfaceIncidentIds`. También se comprueba la compatibilidad de la versión de red.
- **Validación y Corrección Humana:** Se incorporaron pruebas de la traducción y del intercambio mediante MCP. Los casos comprueban que una superficie no cierre automáticamente todos sus tramos cercanos y que las restricciones peatonales no se conviertan en bloqueos para el proveedor general. Referencia: commit `5d10306`.

## Rechazo de restricciones de superficie sin procesar

- **Problema abordado:** El motor general no evalúa la geometría de las superficies. Permitir que recibiera sus referencias sin comprobarlas podía provocar que una restricción se ignorara silenciosamente.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para establecer un control entre el motor de superficies y los motores inferiores.
- **Código / Arquitectura generada:** Se añadió `consumeSurfaceRestrictions()`, que compara las referencias recibidas con los bloqueos de superficie proporcionados por el backend. Después de comprobarlas, las retira de la solicitud destinada al cálculo inferior. El motor general rechaza referencias pendientes de procesar.
- **Validación y Corrección Humana:** Se agregaron pruebas para comprobar la correspondencia de identificadores, la versión de red y el rechazo desde el motor general. Este control verifica las referencias, sin sustituir la evaluación geométrica ni comparar por sí solo todo el contenido de los incidentes. Referencia: commit `5d10306`.

## Validación final diferenciada de las alternativas

- **Problema abordado:** La comprobación final debía respetar el alcance de cada bloqueo sin depender de lo que afirmara la explicación de Claude.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo reunir las comprobaciones finales y reutilizarlas desde el agente.
- **Código / Arquitectura generada:** Se incorporó `validateRestrictedRoute()`. Comprueba proveedor y versión de red para restricciones peatonales, exige identificadores recorridos cuando hay cierres por tramo y verifica las intersecciones de las áreas rectangulares. La geometría de superficies continúa bajo responsabilidad de su motor.
- **Validación y Corrección Humana:** Se añadieron casos que permiten utilizar la vereda opuesta, rechazan tramos cerrados y mantienen el rechazo de áreas bloqueadas. Las pruebas incorporadas utilizan datos y servicios simulados, sin demostrar una evaluación completa con el proveedor de IA y el despliegue. Referencia: commit `5d10306`.

## Envío de resúmenes de incidentes a la IA

- **Problema abordado:** El modelo necesita información sobre los incidentes, pero no sus polígonos completos ni los identificadores internos de las conexiones.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo limitar los datos enviados a Claude y mantener la información geométrica bajo responsabilidad del backend.
- **Código / Arquitectura generada:** Se incorporó `summarizeRoutingIncident()`, que selecciona explícitamente seis campos: identificador, tipo, efecto, descripción, inicio y vencimiento. MCP utiliza esta representación al comunicar los incidentes al modelo.
- **Validación y Corrección Humana:** Se añadieron pruebas para comprobar que el resumen no incluya coordenadas ni identificadores de tramos, incluso cuando el registro contiene geometrías extensas. La selección explícita evita incorporar automáticamente nuevos campos al mensaje enviado. Referencia: commit `cf1538e`.

## Reutilización de consultas dentro de cada evaluación

- **Problema abordado:** El agente, las herramientas MCP y el cálculo podían consultar repetidamente los mismos incidentes durante una evaluación.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo compartir esa lectura sin mezclar simulaciones ni eliminar la comprobación final de cambios.
- **Código / Arquitectura generada:** Se creó `createSurfaceEvaluation()`, con una instancia por solicitud y promesas reutilizables para las consultas. Se fija la simulación y la fecha, y las herramientas comparten los datos iniciales. La validación final dispone de una lectura independiente.
- **Validación y Corrección Humana:** Se incorporaron pruebas de consultas concurrentes, reutilización de resultados y rechazo de otra simulación o fecha antes de consultar. También se comprueba que la lectura final obtenga datos nuevos. Esta reutilización pertenece a cada evaluación y no constituye una caché global. Referencia: commit `cf1538e`.

## Detección de cambios en incidentes que conservan su identificador

- **Problema abordado:** Comparar únicamente los identificadores no permite detectar que un bloqueo cambió de ubicación, geometría o vigencia durante el cálculo.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para contrastar el contenido utilizado al comenzar con una lectura nueva antes de entregar la alternativa.
- **Código / Arquitectura generada:** Se incorporó una huella SHA-256 de los registros completos de bloqueo, incluidas sus geometrías. La huella se calcula por partes y ordena registros y propiedades para evitar diferencias causadas únicamente por su orden.
- **Validación y Corrección Humana:** Se añadieron pruebas de modificaciones con el mismo identificador y de independencia respecto del orden de propiedades y registros. También se contempla el rechazo de la alternativa cuando falla la comprobación final. La huella permanece en el backend. Referencia: commit `cf1538e`.

## Recuperación de cartografía histórica cuando resulta necesaria

- **Problema abordado:** Un incidente vencido puede conservar superficies útiles para reconectar al robot, aunque ya no deba restringir su movimiento. Consultar siempre todo el historial también añade trabajo innecesario.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo aprovechar esa cartografía sin reactivar obstáculos vencidos ni repetir cálculos que no aporten información.
- **Código / Arquitectura generada:** Primero se calcula con los incidentes activos. Ante un error `422`, se consulta el historial y se buscan superficies adicionales que contengan el origen. Solo se repite el cálculo si aparecen geometrías nuevas, manteniendo los bloqueos activos originales.
- **Validación y Corrección Humana:** Se incorporaron pruebas de recuperación mediante cartografía histórica, exclusión de incidentes futuros o vencidos y conservación del error cuando el historial no aporta superficies. Los casos utilizan dependencias simuladas y no acreditan el flujo completo en el despliegue. Referencia: commit `cf1538e`.

## Separación de solicitudes y validadores de incidentes

- **Problema abordado:** Las solicitudes HTTP y las comprobaciones de respuestas estaban mezcladas con responsabilidades de presentación, dificultando su reutilización y prueba.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo organizar módulos específicos para la API de incidentes y las operaciones del editor.
- **Código / Arquitectura generada:** Se incorporaron `incident-api.ts`, `editor-api.ts` e `incident-validation.ts`. También se separaron los validadores peatonales de la representación de la red.
- **Validación y Corrección Humana:** Se añadieron pruebas con respuestas simuladas para rechazar historiales de otra simulación, superficies incompletas, ubicaciones inválidas y efectos desconocidos. En esta etapa todavía no se valida el contenido de las confirmaciones de contexto y guardado. Referencia: commit `bae1dce`.

## Estados explícitos para la edición de ubicaciones

- **Problema abordado:** La selección, confirmación y cancelación necesitaban reglas claras para evitar guardar ubicaciones modificadas sin confirmar o alterar el borrador durante un guardado.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo representar esas transiciones mediante un reducer independiente de React y Leaflet.
- **Código / Arquitectura generada:** Se creó `editor-state.ts` con fases de edición, ubicación, modificación, confirmación y guardado. Se conserva una copia de la selección y su alcance para restaurarlos al cancelar.
- **Validación y Corrección Humana:** Se incorporaron pruebas que exigen confirmar antes de guardar, invalidan la confirmación al modificar el alcance y bloquean nuevas ediciones durante el guardado. También se comprueba que una selección tardía no reponga un borrador cancelado. Son pruebas de las transiciones, sin montar el editor completo. Referencia: commit `bae1dce`.

## Preparación de solicitudes estables para reintentos

- **Problema abordado:** Repetir un reporte después de perder la respuesta no debería generar otro identificador ni cambiar su fecha y contenido.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para extraer la preparación del envío y conservar la solicitud original mientras el borrador siga siendo equivalente.
- **Código / Arquitectura generada:** Se incorporó `prepareSubmission()`, que genera el identificador, captura una única fecha para inicio y contexto temporal, y selecciona el endpoint según la ubicación. Una clave del borrador permite reutilizar la solicitud anterior.
- **Validación y Corrección Humana:** Se añadió una prueba que comprueba la conservación del identificador, la fecha y el cuerpo al reintentar. La garantía de no duplicar registros continúa dependiendo de los controles de persistencia del backend. Referencia: commit `bae1dce`.

## Extracción de reglas de vigencia y presentación de incidentes

- **Problema abordado:** El historial y el mapa necesitaban compartir criterios de vigencia, combinación de registros y detección de bloqueos sobre el recorrido.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo separar esas reglas de las consultas HTTP y los componentes visuales.
- **Código / Arquitectura generada:** Se creó `incident-rules.ts` con funciones para determinar estados temporales, combinar registros por identificador y preparar resúmenes. Los incidentes sobre superficies utilizan su geometría de colisión para comprobar su relación con el recorrido.
- **Validación y Corrección Humana:** Se incorporaron casos de inicio inclusivo, vencimiento exclusivo, actualización sin duplicados y precauciones que no cierran el paso. También se comprobó con geometrías sintéticas que una superficie afectada no bloquee automáticamente la vereda opuesta. Este commit prepara los módulos y sus pruebas, sin completar todavía la migración de los componentes existentes. Referencia: commit `bae1dce`.

## Separación de responsabilidades del formato compacto

- **Problema abordado:** `pedestrian-compact.ts` concentraba la compilación, lectura del binario, consultas espaciales y búsqueda de rutas, dificultando revisar cada responsabilidad.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo dividir el módulo conservando el formato existente y la compatibilidad con sus consumidores.
- **Código / Arquitectura generada:** Se separaron el modelo de datos, el compilador, la codificación, la decodificación, las coordenadas, los textos, las consultas espaciales y el cálculo de rutas. El archivo original quedó como entrada pública con las exportaciones anteriores.
- **Validación y Corrección Humana:** Se incorporó una prueba que compila, codifica y decodifica una red sintética y compara sus consultas y recorridos. El objetivo fue conservar el comportamiento durante la reorganización, sin introducir otro motor de búsqueda. Referencia: commit `93992bd`.

## Validación estructural de la captura binaria

- **Problema abordado:** Reconocer la firma del archivo no alcanza para aceptar sus datos. Una captura truncada o con referencias inválidas puede impedir cargar correctamente la red.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para identificar las comprobaciones necesarias antes de utilizar las columnas del archivo compacto.
- **Código / Arquitectura generada:** Se incorporó un decodificador que comprueba firma, versión, encabezado, tipos de columnas, posiciones, tamaños y alineación. También valida desplazamientos, referencias, coordenadas, distancias e identificadores ordenados y únicos de los tramos.
- **Validación y Corrección Humana:** Se añadieron casos de encabezados inválidos, archivos truncados, descriptores alterados y contenido inconsistente. Estas comprobaciones detectan problemas estructurales, sin demostrar la autenticidad del archivo ni la cobertura real de la cartografía. Referencia: commit `93992bd`.

## Lectura del binario sin duplicar las columnas

- **Problema abordado:** La validación debía conservar la representación compacta y evitar reconstruir toda la red como objetos o copiar sus columnas al cargarla.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo utilizar vistas numéricas sobre el mismo almacenamiento y comprobar sus requisitos de alineación.
- **Código / Arquitectura generada:** El decodificador construye vistas `Uint8Array`, `Uint32Array` y `Float64Array` sobre el buffer recibido. Se comprueba la alineación de cada columna y se exige una plataforma compatible con el orden de bytes del formato.
- **Validación y Corrección Humana:** Se incorporó una prueba que comprueba que las vistas comparten el buffer, incluido un archivo ubicado en un desplazamiento alineado. Esto verifica la reutilización del almacenamiento, sin constituir una medición del consumo total de memoria del backend. Referencia: commit `93992bd`.

## Unificación del transporte HTTP del frontend

- **Problema abordado:** Distintos componentes y utilidades conservaban solicitudes propias o importaban el cliente HTTP desde módulos de otra funcionalidad.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo centralizar el transporte y separar las solicitudes de la representación visual.
- **Código / Arquitectura generada:** Se adaptaron los consumidores para utilizar `api/client.ts` y se extrajeron módulos para reportes aleatorios, red peatonal y cartografía del editor. Los componentes delegan las solicitudes y reciben resultados comprobados.
- **Validación y Corrección Humana:** Se incorporaron pruebas con `fetch` simulado para comprobar la conservación del cuerpo al reintentar, la propagación de cancelación y los mensajes de rechazo del backend. Esto no incorpora todavía la conservación del estado HTTP ni corrige el tratamiento de todos los fallos de lectura del JSON. Referencia: commit `5576c9b`.

## Validación de respuestas según cada funcionalidad

- **Problema abordado:** Compartir el transporte no elimina la necesidad de comprobar los contratos particulares antes de utilizar los datos recibidos.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para separar validaciones básicas reutilizables de las comprobaciones específicas de incidentes y cartografía.
- **Código / Arquitectura generada:** Se incorporó `api/validation.ts` con comprobaciones de objetos, números finitos, coordenadas, fechas y límites geográficos. Cada módulo mantiene la validación de su respuesta, incluyendo reportes creados u omitidos, redes y superficies.
- **Validación y Corrección Humana:** Se añadieron casos que rechazan incidentes de otra simulación y superficies incompletas. También se comprueba que una consulta de red sin tramos sea válida, evitando confundir ausencia de elementos con una respuesta incorrecta. Las pruebas verifican los contratos mediante respuestas simuladas. Referencia: commit `5576c9b`.

## Separación del proveedor cartográfico y consultas compartidas

- **Problema abordado:** El servicio de superficies mezclaba la interpretación de DC GIS con la caché y podía repetir consultas simultáneas para una misma zona.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo separar el proveedor y compartir las lecturas pendientes sin que cancelar un consumidor interrumpiera a los demás.
- **Código / Arquitectura generada:** Se extrajo `dc-gis-provider.ts` y se incorporó `ReadCache`. Se conservan hasta ocho zonas durante cinco minutos y las solicitudes de una misma clave comparten una consulta pendiente. Si todos los consumidores cancelan, se cancela también la consulta al proveedor.
- **Validación y Corrección Humana:** Se añadió una prueba con `fetch` simulado que inicia dos consultas, cancela una y comprueba que la otra recibe el resultado mediante una única llamada. La separación conserva las validaciones cartográficas anteriores, sin corregir todavía los límites aplicados después de descargar o procesar los datos. Referencia: commit `9b2ea44`.

## Separación de la programación de reportes y las notificaciones

- **Problema abordado:** `RandomFleetReports` reunía el calendario de generación, las solicitudes, los reintentos y la presentación de avisos, dificultando revisar cada responsabilidad.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo separar esa lógica conservando el comportamiento de los reportes automáticos.
- **Código / Arquitectura generada:** Se extrajeron `useRandomReportScheduler`, `useFleetNotifications` y funciones para preparar el cuerpo y avanzar el calendario. El componente quedó centrado en la presentación. También se agregó una clave por simulación y versión de red para reiniciar su estado al cambiar de contexto.
- **Validación y Corrección Humana:** Se revisó la conservación del cuerpo original al reintentar, el control de solicitudes simultáneas y la cancelación al desmontar. Se mantuvieron los ocho avisos recientes y la notificación de ocho segundos reales, independiente del reloj simulado. Este commit no incorpora pruebas nuevas ni resuelve la coherencia entre fechas y recorridos de reportes atrasados. Referencia: commit `d89fbc6`.

## Separación entre historial y geometrías activas

- **Problema abordado:** Consultar todos los incidentes completos transfería geometrías innecesarias para mostrar el historial, aunque muchos reportes todavía no estuvieran activos o ya hubieran vencido.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo separar los datos del historial de los necesarios para representar los incidentes vigentes.
- **Código / Arquitectura generada:** Se incorporó `/api/surfaces/snapshot`, que devuelve resúmenes históricos y geometrías activas. PostgreSQL selecciona los campos necesarios, evitando recuperar las superficies de contexto completas. También se agregó una consulta individual de detalle que comprueba la pertenencia del incidente a la simulación.
- **Validación y Corrección Humana:** Se añadieron pruebas con persistencia simulada para comprobar la separación de ambas representaciones. En el frontend se valida la simulación, la ausencia de identificadores duplicados y la presencia de los datos correspondientes a cada resumen activo. Referencia: commit `331f97a`.

## Coordinación de lecturas y descarte de respuestas anteriores

- **Problema abordado:** Las actualizaciones del historial podían superponerse o completar después de cambiar de simulación, publicando información de una operación anterior.
- **Prompt / Herramienta utilizada:** Consulta a ChatGPT sobre cómo reemplazar lecturas pendientes y conservar únicamente los resultados del contexto vigente.
- **Código / Arquitectura generada:** Se incorporó `LatestRead` y se adaptó `useSimulationIncidents` para cancelar lecturas anteriores, separar los registros por simulación y solicitar las geometrías de incidentes que entran en vigencia.
- **Validación y Corrección Humana:** Se añadieron pruebas del descarte de lecturas reemplazadas o canceladas y del rechazo de respuestas con incidentes activos incompletos. Estos controles coordinan las consultas, sin resolver por sí solos todas las condiciones que deben impedir el movimiento mientras falta información. Referencia: commit `331f97a`.

## Propagación de la cancelación HTTP a las consultas cartográficas

- **Problema abordado:** Una consulta al proveedor podía continuar aunque el cliente hubiera interrumpido la solicitud y ya no necesitara su resultado.
- **Prompt / Herramienta utilizada:** Se pidió ayuda a ChatGPT para vincular la desconexión HTTP con las operaciones cartográficas que admiten cancelación.
- **Código / Arquitectura generada:** Se añadió una señal por solicitud y se transmitió a las consultas de superficies utilizadas en ubicación, vista previa y preparación del guardado. La señal se cancela ante una interrupción, diferenciándola de una respuesta terminada normalmente.
- **Validación y Corrección Humana:** Se incorporaron pruebas de cierre incompleto, interrupción y finalización normal. También se ampliaron los casos de consultas compartidas, comprobando que cancelar un consumidor no interrumpa a otro y que una respuesta tardía cancelada no reponga la caché. Esto no garantiza detener cálculos síncronos ni deshacer escrituras confirmadas. Referencia: commit `331f97a`.

## Actualización de incidentes sin duplicados ni cambios innecesarios

- **Problema abordado:** Una nueva lectura puede devolver los mismos incidentes o modificar su geometría manteniendo el identificador. Comparar solo IDs puede ocultar cambios, mientras reemplazar siempre los objetos provoca actualizaciones innecesarias.
- **Prompt / Herramienta utilizada:** Se consultó a ChatGPT cómo combinar registros conservando referencias cuando el contenido no cambia y detectando modificaciones relevantes.
- **Código / Arquitectura generada:** Se adaptó la combinación por identificador para reutilizar registros equivalentes y aceptar cambios de contenido. La publicación de incidentes prioriza su geometría de superficie sobre los datos por tramo conservados por compatibilidad.
- **Validación y Corrección Humana:** Se añadió una prueba que comprueba la reutilización de referencias idénticas y la detección de otra geometría con el mismo ID. Las verificaciones incorporadas no sustituyen una prueba completa del mapa y la simulación en navegador. Referencia: commit `331f97a`.

## Revisión técnica y consolidación del registro de IA

**Contexto:** Antes de continuar con nuevas funcionalidades, decidí revisar la implementación actual y contrastarla con el alcance previsto para el MVP.

**Consulta:** Solicité apoyo de IA para la estructura de la auditoría, analizar las observaciones que fui reuniendo durante la revisión del código y definir verificaciones para los problemas identificados.

**Decisión:** Documentar los comportamientos observados, los hallazgos y los cambios previstos, distinguiendo las comprobaciones ejecutadas de las pendientes. También consolidar las entradas anteriores de uso de IA a partir de las conversaciones y los cambios del proyecto, para documentarlos.

**Seguimiento:** El proceso se documenta en `docs/AUDITORIA.md`. Las correcciones se vincularán con sus commits y resultados de verificación.

## Planificación de la auditoría técnica

- **Problema abordado:** Necesitaba establecer un plazo realista para realizar la auditoría técnica de RouteRobots, considerando que desarrollo el proyecto individualmente y debo dedicar tiempo a otras materias.

- **Prompt / Herramienta utilizada:** Consulté a ChatGPT cómo organizar la auditoría y cuánto tiempo sería razonable dedicarle sin retrasar el resto del proyecto.

- **Propuesta de la IA:** Se propuso distribuir la revisión entre el 22 de octubre y el 3 de noviembre de 2026, comenzando por la arquitectura y el backend, continuando con el frontend y las integraciones, y finalizando con las pruebas, la documentación y las verificaciones generales.

- **Validación y decisión humana:** Evalué la propuesta considerando mi disponibilidad y las fechas de entrega de las demás materias. Decidí establecer el 3 o 4 de noviembre como fecha límite, priorizando los errores importantes y dejando documentadas las mejoras secundarias que no lleguen a resolverse.

## Evaluación del sistema de puntuación de incidentes y accesibilidad de veredas

- **Problema abordado:** Evaluar cómo implementar un sistema de puntuación de riesgos para los segmentos de las rutas, considerando los incidentes reportados por los robots. También se consultó sobre la capacidad de los robots para subir y bajar cordones sin rampas y la conveniencia de representar estos puntos en el mapa.

- **Prompt / Herramienta utilizada:** Consulté a ChatGPT sobre la viabilidad de asignar penalizaciones a las calles según sus incidentes, establecer umbrales para recomendar rutas alternativas y determinar si era conveniente incorporar puntos de acceso a las veredas mediante rampas.

- **Código / Arquitectura propuesta:** La IA recomendó separar las restricciones de circulación de las penalizaciones acumulativas. Un bloqueo total impediría utilizar un segmento, mientras que los incidentes menores aumentarían su costo. También propuso considerar las capacidades físicas de cada robot y registrar las rampas o puntos de transición entre veredas, ya que no todos los modelos pueden superar los mismos desniveles.

- **Validación y decisión humana:** Considero adecuada la separación entre restricciones y penalizaciones, ya que evita recomendar rutas físicamente intransitables. También considero interesante incorporar información sobre rampas y desniveles, aunque primero será necesario evaluar la disponibilidad de estos datos y las capacidades de los robots.
Por otro lado, decidí que el cálculo de puntuaciones no debería depender de la IA, dado que puede resolverse mediante reglas y algoritmos tradicionales, reduciendo costos y facilitando las verificaciones. Estas propuestas quedan pendientes de implementación y validación durante el desarrollo de las próximas funcionalidades.

## Actualización del README y justificación del stack tecnológico

- **Problema abordado:** El README necesitaba actualizarse para reflejar el enfoque actual de RouteRobots, incluyendo la gestión colaborativa de incidentes, la evaluación de riesgos y las funcionalidades previstas. También quería justificar las tecnologías utilizadas desde mi experiencia personal, evitando explicaciones genéricas.

- **Prompt / Herramienta utilizada:** Mediante transcripción de voz, le expliqué a ChatGPT cómo había evolucionado la idea de RouteRobots y qué funcionalidades quería incorporar. Le compartí el README existente y solicité una propuesta de actualización.

- **Código / Arquitectura generada:** La IA propuso una nueva organización del README, actualizando la descripción del proyecto, sus objetivos y funcionalidades. No se generó código funcional.

- **Validación y Corrección Humana:** Revisé la propuesta y continue con modificaciones para que las justificaciones reflejaran mis decisiones reales, y también se diferenciaron las funcionalidades existentes de las previstas, evitando presentar características todavía no implementadas como terminadas. La versión definitiva del README quedará sujeta a la verificación del estado actual del proyecto durante la auditoría.

## Corrección ortográfica de la documentación

- **Problema abordado:** Necesitaba agilidad para corregir errores ortográficos y de puntuación en el texto de la auditoría en la sección 3.
- **Prompt / Herramienta utilizada:** solicitud de revisión ortográfica mediante ChatGPT.
- **Código / Arquitectura generada:** propuestas de corrección del texto.
- **Validación y Corrección Humana:** revisé las correcciones y seleccioné las que incorporé al documento.

## Almacenamiento de superficies complementarias
- **Problema abordado:**
Existen faltantes de superficies en lugares donde la red peatonal contiene caminos. Se necesita incorporar polígonos complementarios sin desarrollar una administración innecesaria para la demo.

- **Prompt / Herramienta utilizada:**
ChatGPT: «¿Es necesaria una tabla para las superficies que completaré manualmente o conviene mantenerlas en un archivo versionado? Evaluá la alternativa según la edición prevista y su incorporación al mapa y al cálculo geométrico».

- **Código / Arquitectura generada:**
Inicialmente se propuso manual_walk_surfaces. Después se reconsideró esa solución y se recomendó un GeoJSON versionado en el repositorio, leído por el backend junto con las superficies oficiales.

- **Validación y Corrección Humana:**
Elegí el archivo porque las correcciones serán mantenidas por mí y no requieren edición desde la aplicación. Los polígonos deberán identificar su procedencia; dibujarlos no demuestra que sean transitables. Queda pendiente comprobar que se utilicen tanto en el mapa como en las evaluaciones, sin crear conexiones indebidas entre caminos.


## Separar la replanificación del uso de IA

**Problema abordado:**  
Durante la revisión observé que Claude interviene para solicitar consultas y cálculos que ya están implementados en el backend. Esta dependencia no aporta a mi objetivo principal para la IA: interpretar reportes de robots y generar instrucciones preventivas sobre el recorrido.

**Prompt / Herramienta utilizada:**  
ChatGPT Quiero trasladar la coordinación del desvío al backend y reservar la IA para interpretar incidentes y preparar instrucciones preventivas. Revisá las dependencias de `agents`, las ventajas y desventajas del cambio y qué controles debemos conservar antes de retirarlo, esto para agilizar la replanificación puesto que en principio crei que esto le daría valor al proyecto con la IA de esta forma, pero la verdad creo que simplemente lo esta realentizando.

**Código / Arquitectura generada:**  
Se propuso organizar la replanificación como un servicio independiente de Claude, actualizar sus consumidores y separar las funciones de interpretación y generación de informes.

**Validación y Corrección Humana:**  
Decidí retirar la intermediación de IA en una secuencia de pasos obligatorios y conservar el cálculo y sus validaciones en el backend. La consulta se utilizó para contrastar la decisión e identificar las dependencias que deben actualizarse. Se mantendrán el contexto fijo, la lectura final de incidentes y la comparación de su contenido. La reducción de llamadas al proveedor deberá comprobarse mediante pruebas y mediciones de tiempo.


## Reducción de la superficie de ataque

**Problema abordado:**  
Al retirar OpenRouteService, busqué reducir las integraciones y credenciales que debe mantener el MVP.

**Prompt / Herramienta utilizada:**  
ChatGPT: «¿Eliminar una integración externa que ya no necesitamos reduce la superficie de ataque? 

**Código / Arquitectura generada:**  
Se recomendó retirar el adaptador, la configuración de su clave y el modo que permite solicitar rutas externas, porque no tiene sentido mantenerlo para un futuro.

**Validación y Corrección Humana:**  
Decidí incluir esa limpieza en el cambio. El beneficio es reducir código expuesto y credenciales que proteger; no implica que el proveedor sea inseguro ni sustituye los controles de acceso y límites de solicitudes.


## Auditoría del backend — Sección 4

**Consulta:** Solicité ayuda para ordenar las observaciones que fui reuniendo al revisar el backend y contrastarlas con el alcance del MVP.

**Aporte de la IA:** Colaboró en la revisión de los puntos planteados, sus consecuencias y las posibles correcciones. También ayudó a estructurar los hallazgos sobre API, persistencia, geometría y replanificación, distinguiendo observaciones de código, reproducciones aisladas y cambios pendientes.

**Decisión:** Documentar las correcciones justificadas y conservar los controles útiles, evitando refactorizaciones que no aporten al objetivo del proyecto.

## Auditoría del frontend — Sección 5

**Consulta:** Pedí apoyo para revisar el frontend a partir de las decisiones tomadas para el backend y organizar las observaciones sobre estado, movimiento, formularios y comunicación HTTP.

**Aporte de la IA:** Ayudó a contrastar los comportamientos encontrados, identificar inconsistencias y ordenar la sección. Colaboró en las comprobaciones aisladas y en la interpretación de las pruebas disponibles, aclarando sus limitaciones.

**Decisión:** Mantener las validaciones de respuestas y los controles de interfaz, dejando las garantías del dominio en el backend. Registrar las correcciones pendientes sin proponer una reorganización general.