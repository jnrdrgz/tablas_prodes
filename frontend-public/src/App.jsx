import { Routes, Route, Link } from 'react-router-dom'
import Tournaments from './pages/Tournaments'
import Gameweek from './pages/Gameweek'

function App() {
  return (
    <div className="min-h-screen">
      <nav className="bg-gray-900 p-4 mb-4">
        <div className="container mx-auto">
          <Link to="/" className="text-xl font-bold text-blue-400 hover:text-blue-300">
            Tablador
          </Link>
        </div>
      </nav>
      <main className="container mx-auto px-4">
        <Routes>
          <Route path="/" element={<Tournaments />} />
          <Route path="/tournament/:id" element={<Tournaments />} />
          <Route path="/gameweek/:id" element={<Gameweek />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
