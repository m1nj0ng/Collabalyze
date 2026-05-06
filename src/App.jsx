import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import LoadingPage from './pages/LoadingPage';
import DashboardPage from './pages/DashboardPage';
import DetailPage from './pages/DetailPage';
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/detail/:memberId" element={<DetailPage />} />
      </Routes>
    </Router>
  );
}

export default App;
