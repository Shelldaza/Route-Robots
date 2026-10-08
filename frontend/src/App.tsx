import { Link, Route, Routes } from 'react-router'
import HomePage from './pages/HomePage'
import DemoPage from './pages/DemoPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/demo" element={<DemoPage />} />

      <Route
        path="*"
        element={
          <main>
            <h1>Página no encontrada</h1>
            <Link to="/">Volver al inicio</Link>
          </main>
        }
      />
    </Routes>
  )
}

export default App