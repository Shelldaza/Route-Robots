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

## Regularización del registro de uso de IA

**Problema:** Durante el desarrollo inicial no documenté sistemáticamente todas las intervenciones de IA ni las verificaciones y correcciones manuales realizadas.

**Contexto:** Al desarrollar individualmente un proyecto de alcance considerable y con plazos académicos limitados, prioricé la implementación funcional sobre el registro documental de la IA. Reconozco que fue un error metodológico de mi parte.

**Acción correctiva:** Mi intención no es ocultarlo ni recostruir falsamente documentación, si bien tengo los prompts y demás a lo largo de la carrera se me enseño a ser responsable y tener criterio propio, así que ahora lo que corresponde no es cargar los diferentes prompts antiguos, si no realizar una auditoría retrospectiva, asumir errores y establecer un procedimiento de registro para las futuras intervenciones.

El proceso y sus resultados se documentarán en `docs/AUDITORIA.md`.

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

- **Validación y Corrección Humana:** Revisé la propuesta y continue con modificaciones para que las justificaciones reflejaran mis decisiones reales, yambién se diferenciaron las funcionalidades existentes de las previstas, evitando presentar características todavía no implementadas como terminadas. La versión definitiva del README quedará sujeta a la verificación del estado actual del proyecto durante la auditoría.

## Corrección ortográfica de la documentación

- **Problema abordado:** Necesitaba agilidad para corregir errores ortográficos y de puntuación en el texto de la auditoría en la sección 3.
- **Prompt / Herramienta utilizada:** solicitud de revisión ortográfica mediante ChatGPT.
- **Código / Arquitectura generada:** propuestas de corrección del texto.
- **Validación y Corrección Humana:** revisé las correcciones y seleccioné las que incorporé al documento.