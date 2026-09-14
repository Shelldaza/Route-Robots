Nombre del proyecto: RouteRobots

Alumno: Facundo Daza

Evaluación inteligente de rutas para robots autónomos de reparto

Descripción del problema

Los robots delivery necesitan evaluar factores como la pendiente, el clima, el estado del recorrido y su autonomía. Esta información se encuentra distribuida entre diferentes servicios, lo que dificulta seleccionar una ruta segura y adecuada. 

Propuesta de valor

RouteRobots será una plataforma SaaS para evaluar rutas antes de una entrega. El usuario indicará el origen, destino y características del robot, mientras que una IA consultará mediante MCP información sobre recorridos, pendiente y clima. El sistema clasificará la ruta como apta, apta con supervisión o no recomendada, explicando los motivos y estimando el consumo de batería.

Usuarios objetivo

Empresas de reparto autónomo, universidades y centros de investigación. El MVP se enfocará inicialmente en Washington D. C., donde estos robots están autorizados para operar y existe información pública para desarrollar la solución. Posteriormente, podrá extenderse a otras ciudades según la disponibilidad de datos.

Alcance del MVP

Permitirá registrar usuarios y robots, seleccionar un recorrido en un mapa, consultar rutas alternativas, clima y elevación, evaluar sus riesgos y guardar los resultados. Será una herramienta de planificación y no controlará robots reales.

Inteligencia Artificial y MCP

La IA utilizará herramientas MCP (Model context protocol) para consultar servicios externos y comparar los datos obtenidos con las limitaciones del robot. Así podrá generar una recomendación basada en información actualizada.

Stack tecnológico tentativo ( se ira adaptando según los inconvenientes)

Frontend: React y TypeScript (Despliegue en Vercel).

Backend y MCP: Node.js con Express (Alojado en Render).

Base de datos: PostgreSQL (Neon.tech / Serverless).

Mapas, Rutas y Clima: OpenStreetMap, OpenRouteService y Open-Meteo (APIs públicas).

Cloud & Infraestructura: Arquitectura distribuida usando PaaS/Serverless (Vercel/Render).

CI/CD: GitHub Actions.

Observabilidad: Sentry (monitoreo de errores) y application logs.