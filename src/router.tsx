import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminRoute } from './components/auth/AdminRoute';

import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

import { LoginPage } from './pages/auth/Login';
import { SignupPage } from './pages/auth/Signup';
import { ForgotPasswordPage } from './pages/auth/ForgotPassword';

import { MarketplaceIndex } from './pages/marketplace/Index';
import { MarketplaceDetail } from './pages/marketplace/Detail';
import { MarketplaceCreate } from './pages/marketplace/Create';
import { MarketplaceEdit } from './pages/marketplace/Edit';

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
import { CreateStore } from './pages/store/CreateStore';

import { MessagesIndex } from './pages/messages/Index';
import { MessageDetail } from './pages/messages/Detail';

import { NotificationsIndex } from './pages/notifications/Index';

import { AdminIndex } from './pages/admin/Index';
import { AdminListings } from './pages/admin/Listings';
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
          <ProtectedRoute requireCompleteProfile>
            <MarketplaceCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/marketplace/edit/:id"
        element={
          <ProtectedRoute requireCompleteProfile>
            <MarketplaceEdit />
          </ProtectedRoute>
        }
      />
      <Route path="/marketplace/:id" element={<MarketplaceDetail />} />

      {/* Services */}
      <Route path="/services" element={<ServicesIndex />} />
      <Route
        path="/services/create"
        element={
          <ProtectedRoute requireCompleteProfile>
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
          <ProtectedRoute requireCompleteProfile>
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
          <ProtectedRoute requireCompleteProfile>
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

      {/* Stores (Protected) */}
      <Route
        path="/store/create"
        element={
          <ProtectedRoute requireCompleteProfile>
            <CreateStore />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stores/create"
        element={
          <ProtectedRoute requireCompleteProfile>
            <CreateStore />
          </ProtectedRoute>
        }
      />

      {/* Messages (Protected) */}
      <Route
        path="/messages"
        element={
          <ProtectedRoute requireCompleteProfile>
            <MessagesIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages/:id"
        element={
          <ProtectedRoute requireCompleteProfile>
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

      {/* Admin (Protected by AdminRoute) */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminIndex />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/listings"
        element={
          <AdminRoute>
            <AdminListings />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminUsers />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <AdminRoute>
            <AdminReports />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/verifications"
        element={
          <AdminRoute>
            <AdminVerifications />
          </AdminRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
