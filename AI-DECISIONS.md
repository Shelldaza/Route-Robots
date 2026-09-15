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

