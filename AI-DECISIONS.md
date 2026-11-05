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
- **Validación y Corrección Humana:** Se investigó la sugerencia de la IA y se confirmó que `tsx` es el estándar actual de la industria para versiones recientes de Node.js (v20+). Se aplicó el cambio, lo que resolvió el error inmediatamente.


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


### Separar la replanificación del uso de IA

**Problema abordado:**  
Durante la revisión observé que Claude interviene para solicitar consultas y cálculos que ya están implementados en el backend. Esta dependencia no aporta a mi objetivo principal para la IA: interpretar reportes de robots y generar instrucciones preventivas sobre el recorrido.

**Prompt / Herramienta utilizada:**  
ChatGPT Quiero trasladar la coordinación del desvío al backend y reservar la IA para interpretar incidentes y preparar instrucciones preventivas. Revisá las dependencias de `agents`, las ventajas y desventajas del cambio y qué controles debemos conservar antes de retirarlo, esto para agilizar la replanificación puesto que en principio crei que esto le daría valor al proyecto con la IA de esta forma, pero la verdad creo que simplemente lo esta realentizando.

**Código / Arquitectura generada:**  
Se propuso organizar la replanificación como un servicio independiente de Claude, actualizar sus consumidores y separar las funciones de interpretación y generación de informes.

**Validación y Corrección Humana:**  
Decidí retirar la intermediación de IA en una secuencia de pasos obligatorios y conservar el cálculo y sus validaciones en el backend. La consulta se utilizó para contrastar la decisión e identificar las dependencias que deben actualizarse. Se mantendrán el contexto fijo, la lectura final de incidentes y la comparación de su contenido. La reducción de llamadas al proveedor deberá comprobarse mediante pruebas y mediciones de tiempo.


### Reducción de la superficie de ataque

**Problema abordado:**  
Al retirar OpenRouteService, busqué reducir las integraciones y credenciales que debe mantener el MVP.

**Prompt / Herramienta utilizada:**  
ChatGPT: «¿Eliminar una integración externa que ya no necesitamos reduce la superficie de ataque? 

**Código / Arquitectura generada:**  
Se recomendó retirar el adaptador, la configuración de su clave y el modo que permite solicitar rutas externas, porque no tiene sentido mantenerlo para un futuro.

**Validación y Corrección Humana:**  
Decidí incluir esa limpieza en el cambio. El beneficio es reducir código expuesto y credenciales que proteger; no implica que el proveedor sea inseguro ni sustituye los controles de acceso y límites de solicitudes.


### Auditoría del backend — Sección 4

**Consulta:** Solicité ayuda para ordenar las observaciones que fui reuniendo al revisar el backend y contrastarlas con el alcance del MVP.

**Aporte de la IA:** Colaboró en la revisión de los puntos planteados, sus consecuencias y las posibles correcciones. También ayudó a estructurar los hallazgos sobre API, persistencia, geometría y replanificación, distinguiendo observaciones de código, reproducciones aisladas y cambios pendientes.

**Decisión:** Documentar las correcciones justificadas y conservar los controles útiles, evitando refactorizaciones que no aporten al objetivo del proyecto.