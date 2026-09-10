import { Routes, Route, Link, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Tournaments from './pages/Tournaments'
import Tournament from './pages/Tournament'
import Gameweek from './pages/Gameweek'
import Debug from './pages/Debug'
import WhatsappInputs from './pages/WhatsappInputs'
import OtherTables from './pages/OtherTables'
import FraudAnalysis from './pages/FraudAnalysis'

function App() {
  return (
    <div className="min-h-screen">
      <nav className="bg-gray-900 p-4 mb-4">
        <div className="container mx-auto flex gap-4">
          <Link to="/" className="text-xl font-bold text-blue-400 hover:text-blue-300">
            Tablas
          </Link>
          <Link to="/tournaments" className="text-gray-300 hover:text-white">
            Torneos
          </Link>
          <Link to="/tablas/general" className="text-gray-300 hover:text-white">
            Otras Tablas
          </Link>
          <Link to="/inputs" className="text-gray-300 hover:text-white">
            Historial
          </Link>
          <Link to="/debug" className="text-gray-300 hover:text-white">
            Debug
          </Link>
        </div>
      </nav>
      <main className="container mx-auto px-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/tournament/:id" element={<Tournament />} />
          <Route path="/gameweek/:id" element={<Gameweek />} />
          <Route path="/tablas/:tab" element={<OtherTables />} />
          <Route path="/tablas" element={<Navigate to="/tablas/general" replace />} />
          <Route path="/general" element={<Navigate to="/tablas/general" replace />} />
          <Route path="/historica" element={<Navigate to="/tablas/historica" replace />} />
          <Route path="/fraud/:id" element={<FraudAnalysis />} />
          <Route path="/debug" element={<Debug />} />
          <Route path="/inputs" element={<WhatsappInputs />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
