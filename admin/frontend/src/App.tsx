import { Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center"><h1 className="text-2xl font-bold">Admin Backoffice</h1></div>} />
    </Routes>
  )
}
