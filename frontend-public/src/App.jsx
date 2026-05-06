import { Routes, Route, Link } from 'react-router-dom'
import Tournaments from './pages/Tournaments'
import Gameweek from './pages/Gameweek'
import GeneralTable from './pages/GeneralTable'
import PositionEvolution from './pages/PositionEvolution'

function App() {
  return (
    <div className="min-h-screen">
      <nav className="bg-brand-950 border-b border-brand-900 p-4 mb-4">
        <div className="container mx-auto flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo_cmn.png" alt="Conmigliazzo" className="h-10 w-10 invert" />
            <span className="text-xl font-bold text-red-400 hover:text-red-300 font-bebas tracking-wider">
              Prodes Conmigliazzo
            </span>
          </Link>
          <Link to="/general" className="text-gray-300 hover:text-white">
            Tabla General Temporada
          </Link>
        </div>
      </nav>
      <main className="container mx-auto px-4">
        <Routes>
          <Route path="/" element={<Tournaments />} />
          <Route path="/tournament/:id" element={<Tournaments />} />
          <Route path="/gameweek/:id" element={<Gameweek />} />
          <Route path="/general" element={<GeneralTable />} />
          <Route path="/tournament/:id/evolution" element={<PositionEvolution />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
