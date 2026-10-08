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
              COORDINACIÓN INTELIGENTE PARA ROBOTS DE REPARTO
            </span>

            <h1>
              El próximo robot no debería
              <br />
              encontrar el mismo obstáculo.
            </h1>

            <p>
              La experiencia de una flota puede prevenir y mejorar las decisiones
              de toda la red.
            </p>

            <p className="hero-description">
              RouteRobots es una plataforma SaaS que conecta las
              capacidades de cada robot con la información del entorno.
              Su objetivo es asignar recorridos, interpretar reportes
              y conservar lo aprendido para actuales y futuras misiones mediante el analisis con inteligencia artificial.
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