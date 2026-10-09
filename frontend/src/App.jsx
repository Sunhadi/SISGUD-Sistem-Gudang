import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import Locations from './pages/Locations';
import Parties from './pages/Parties';
import InboundList from './pages/InboundList';
import InboundDetail from './pages/InboundDetail';
import Stocks from './pages/Stocks';
import StockCard from './pages/StockCard';
import OpnameList from './pages/OpnameList';
import OpnameDetail from './pages/OpnameDetail';
import OutboundList from './pages/OutboundList';
import OutboundDetail from './pages/OutboundDetail';
import Reports from './pages/Reports';
import Users from './pages/Users';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />

        {/* Master data — semua role bisa lihat */}
        <Route path="/items" element={<Items />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/parties" element={<Parties />} />

        {/* Inbound */}
        <Route path="/inbound" element={<InboundList />} />
        <Route path="/inbound/:id" element={<InboundDetail />} />

        {/* Inventory */}
        <Route path="/inventory/stocks" element={<Stocks />} />
        <Route path="/inventory/stock-card" element={<StockCard />} />

        {/* Opname — tanpa viewer */}
        <Route
          path="/opname"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'operator_inbound', 'operator_outbound']}>
              <OpnameList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/opname/:id"
          element={
            <ProtectedRoute roles={['admin', 'supervisor', 'operator_inbound', 'operator_outbound']}>
              <OpnameDetail />
            </ProtectedRoute>
          }
        />

        {/* Outbound */}
        <Route path="/outbound" element={<OutboundList />} />
        <Route path="/outbound/:id" element={<OutboundDetail />} />

        {/* Laporan */}
        <Route path="/reports" element={<Reports />} />

        {/* Pengguna — admin saja */}
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
