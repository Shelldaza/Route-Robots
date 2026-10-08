import { Link } from 'react-router'
import robotLogo from '../assets/robot-logo.jpg'
import brandName from '../assets/routerobots-name.jpg'
import './HomePage.css'

function HomePage() {
  return (
    <div className="home-page">
      <header className="home-header">
        <div className="nav-wrap">
          <Link className="brand" to="/"
          aria-label="RouteRobots — Inicio">
            <img className="brand-robot" src={robotLogo} alt="" />
            <img className="brand-name" src={brandName} alt="" />
           </Link>

          <div className="header-right">
            <nav aria-label="Principal" className="landing-nav">
              <a href="#plataforma">Plataforma</a>
            </nav>

            <Link className="button button-small" to="/demo">
              Abrir demo <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="inicio">
        <section className="hero" id="plataforma">
          <div className="hero-copy">
            <span className="eyebrow">
              PLATAFORMA SAAS DE PLANIFICACIÓN Y COORDINACIÓN DE FLOTAS
            </span>

            <h1>
              UNA COMUNIDAD DE ROBOTS
              <br />
              QUE APRENDE EN CADA
              <br /> RECORRIDO.
            </h1>
           
            <p className="hero-description">
                RouteRobots reúne la telemetría y los reportes de incidentes de cada robot, mediante inteligencia artificial
                y una memoria operacional compartida, transforma esas observaciones en contexto 
                para evaluar y asignar rutas, responder ante cambios y coordinar futuras entregas con menos intervención humana.
            </p>

            <div className="hero-actions">
              <Link className="button" to="/demo">
                Explorar la demo <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default HomePage