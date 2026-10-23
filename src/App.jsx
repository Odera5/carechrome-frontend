import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import RoutePersistence from "./components/RoutePersistence";
import ErrorBoundary from "./components/ErrorBoundary";
import { readLastVisitedRoute } from "./utils/persistence";
import { getStoredUser } from "./utils/authStorage";

const clearServiceWorkerCaches = async () => {
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update()));
  }
};

const lazyWithRetry = (componentImport) => {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.error("Failed to load chunk, clearing cached app shell and reloading:", error);
      const reloadKey = "carechrome:chunk-reload-timestamp";
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 15000) {
        sessionStorage.setItem(reloadKey, String(now));
        await clearServiceWorkerCaches().catch(() => {});
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("app_reload", String(now));
        window.location.replace(nextUrl.toString());
      }
      throw error;
    }
  });
};

const Login = lazyWithRetry(() => import("./pages/Login"));
const RegisterClinic = lazyWithRetry(() => import("./pages/RegisterClinic"));
const VerifyEmail = lazyWithRetry(() => import("./pages/VerifyEmail"));
const Signup = lazyWithRetry(() => import("./pages/Signup"));
const ClinicSettings = lazyWithRetry(() => import("./pages/ClinicSettings"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const RegisterPatient = lazyWithRetry(() => import("./pages/RegisterPatient"));
const PatientRecord = lazyWithRetry(() => import("./pages/PatientRecord"));
const Appointments = lazyWithRetry(() => import("./pages/Appointments"));
const Billing = lazyWithRetry(() => import("./pages/Billing"));
const CashReconciliation = lazyWithRetry(() => import("./components/Billing/CashReconciliation"));
const WaitingRoom = lazyWithRetry(() => import("./pages/WaitingRoom"));
const Support = lazyWithRetry(() => import("./pages/Support"));
const UpgradePlan = lazyWithRetry(() => import("./pages/UpgradePlan"));
const BranchManagement = lazyWithRetry(() => import("./pages/BranchManagement"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const PendingIntakes = lazyWithRetry(() => import("./pages/PendingIntakes"));
const PatientIntakeForm = lazyWithRetry(() => import("./pages/PatientIntakeForm"));
const PaystackCallback = lazyWithRetry(() => import("./pages/PaystackCallback"));
const Waitlist = lazyWithRetry(() => import("./pages/Waitlist"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const AppointmentResponse = lazyWithRetry(() => import("./pages/AppointmentResponse"));
const DashboardLayout = lazyWithRetry(() => import("./components/layout/DashboardLayout"));
const AuditLogs = lazyWithRetry(() => import("./pages/AuditLogs"));

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
    </div>
  );
}

const ProtectedLayout = () => (
  <ProtectedRoute>
    <DashboardLayout />
  </ProtectedRoute>
);

function HomeRedirect() {
  const storedUser = getStoredUser();
  let user = null;

  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    user = null;
  }

  const lastRoute = readLastVisitedRoute(user);
  
  const fallbackRoute = storedUser
    ? lastRoute || (user?.role === "billing_staff" ? "/billing" : "/dashboard")
    : "/login";

  return <Navigate to={fallbackRoute} replace />;
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <RoutePersistence />
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            {/* Redirect root to login */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Public routes */}
            <Route path="/waitlist" element={<Waitlist />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register-clinic" element={<RegisterClinic />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/appointment-response" element={<AppointmentResponse />} />
            <Route path="/billing/paystack/callback" element={<PaystackCallback />} />
            <Route path="/support" element={<Support />} />
            <Route path="/intake/:clinicId" element={<PatientIntakeForm />} />

            {/* Protected routes - wrapped with Sidebar Layout */}
            <Route element={<ProtectedLayout />}>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["admin", "branch_manager", "doctor", "nurse"]}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/register-patient" element={<RegisterPatient />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/waiting-room" element={<WaitingRoom />} />
              <Route path="/pending-intakes" element={<PendingIntakes />} />
              <Route
                path="/billing"
                element={
                  <ProtectedRoute
                    allowedRoles={["admin"]}
                    requiredPermission="canAccessBilling"
                  >
                    <Billing />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cash-reconciliation"
                element={
                  <ProtectedRoute allowedRoles={["branch_manager"]}>
                    <CashReconciliation reviewerOnly />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upgrade"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <UpgradePlan />
                  </ProtectedRoute>
                }
              />
              <Route path="/reports" element={<Reports />} />
              
              {/* Require admin/specific roles */}
              <Route
                path="/signup"
                element={
                  <ProtectedRoute allowedRoles={["admin", "branch_manager"]}>
                    <Signup />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clinic-settings"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <ClinicSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute allowedRoles={["admin", "branch_manager"]}>
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/branches"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <BranchManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patients/:id/records"
                element={
                  <ProtectedRoute allowedRoles={["admin", "branch_manager", "doctor", "nurse"]}>
                    <PatientRecord />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback for unknown routes */}
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
