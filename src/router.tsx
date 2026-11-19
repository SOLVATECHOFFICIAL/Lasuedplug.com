import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

import { LoginPage } from './pages/auth/Login';
import { SignupPage } from './pages/auth/Signup';
import { ForgotPasswordPage } from './pages/auth/ForgotPassword';

import { MarketplaceIndex } from './pages/marketplace/Index';
import { MarketplaceDetail } from './pages/marketplace/Detail';
import { MarketplaceCreate } from './pages/marketplace/Create';

import { ServicesIndex } from './pages/services/Index';
import { ServicesDetail } from './pages/services/Detail';
import { ServicesCreate } from './pages/services/Create';

import { AccommodationIndex } from './pages/accommodation/Index';
import { AccommodationDetail } from './pages/accommodation/Detail';
import { AccommodationCreate } from './pages/accommodation/Create';
import { Roommates } from './pages/accommodation/Roommates';

import { SellerDashboard } from './pages/dashboard/Seller';
import { BuyerDashboard } from './pages/dashboard/Buyer';
import { ProfilePage } from './pages/dashboard/Profile';
import { SettingsPage } from './pages/dashboard/Settings';

import { MessagesIndex } from './pages/messages/Index';
import { MessageDetail } from './pages/messages/Detail';

import { NotificationsIndex } from './pages/notifications/Index';

import { AdminIndex } from './pages/admin/Index';
import { AdminUsers } from './pages/admin/Users';
import { AdminReports } from './pages/admin/Reports';
import { AdminVerifications } from './pages/admin/Verifications';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />

      {/* Marketplace */}
      <Route path="/marketplace" element={<MarketplaceIndex />} />
      <Route
        path="/marketplace/create"
        element={
          <ProtectedRoute>
            <MarketplaceCreate />
          </ProtectedRoute>
        }
      />
      <Route path="/marketplace/:id" element={<MarketplaceDetail />} />

      {/* Services */}
      <Route path="/services" element={<ServicesIndex />} />
      <Route
        path="/services/create"
        element={
          <ProtectedRoute>
            <ServicesCreate />
          </ProtectedRoute>
        }
      />
      <Route path="/services/:id" element={<ServicesDetail />} />

      {/* Accommodation & Roommates */}
      <Route path="/accommodation" element={<AccommodationIndex />} />
      <Route
        path="/accommodation/create"
        element={
          <ProtectedRoute>
            <AccommodationCreate />
          </ProtectedRoute>
        }
      />
      <Route path="/accommodation/roommates" element={<Roommates />} />
      <Route path="/accommodation/:id" element={<AccommodationDetail />} />
      <Route path="/roommates" element={<Roommates />} />

      {/* Dashboard & Profile (Protected) */}
      <Route
        path="/dashboard/seller"
        element={
          <ProtectedRoute>
            <SellerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/buyer"
        element={
          <ProtectedRoute>
            <BuyerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Messages (Protected) */}
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <MessagesIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages/:id"
        element={
          <ProtectedRoute>
            <MessageDetail />
          </ProtectedRoute>
        }
      />

      {/* Notifications (Protected) */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsIndex />
          </ProtectedRoute>
        }
      />

      {/* Admin (Protected) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute>
            <AdminReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/verifications"
        element={
          <ProtectedRoute>
            <AdminVerifications />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
