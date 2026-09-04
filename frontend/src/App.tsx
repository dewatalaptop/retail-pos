import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { PrinterProvider } from "./context/PrinterContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import CashierPage from "./pages/CashierPage";
import ProductsPage from "./pages/ProductsPage";
import HistoryPage from "./pages/HistoryPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import CashiersPage from "./pages/CashiersPage";
import HelpPage from "./pages/HelpPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <SettingsProvider>
                  <PrinterProvider>
                    <Layout />
                  </PrinterProvider>
                </SettingsProvider>
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<CashierPage />} />
            <Route path="/riwayat" element={<HistoryPage />} />
            <Route path="/bantuan" element={<HelpPage />} />
            <Route
              path="/produk"
              element={
                <ProtectedRoute permission="canManageProducts">
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/laporan"
              element={
                <ProtectedRoute permission="canViewReports">
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pengaturan"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kasir"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <CashiersPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
