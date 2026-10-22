// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import React from "react";
import { readLastVisitedRoute } from "../utils/persistence";
import {
  clearAuthState,
  getStoredUser,
} from "../utils/authStorage";
import { shouldRestrictAppToBilling, isSubscriptionExpired } from "../utils/clinicAccess";

export default function ProtectedRoute({
  children,
  allowedRoles = [],
  requiredPermission,
}) {
  const location = useLocation();
  const storedUser = getStoredUser();
  let user = null;

  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    clearAuthState();
  }

  if (!user) {
    clearAuthState();
    return <Navigate to="/login" state={{ from: readLastVisitedRoute() }} replace />;
  }

  if (user.role === "billing_staff" && !location.pathname.startsWith("/billing")) {
    return <Navigate to="/billing" replace />;
  }

  const expiredAdminRestricted =
    shouldRestrictAppToBilling(user) &&
    location.pathname !== "/upgrade";

  if (expiredAdminRestricted) {
    return <Navigate to="/upgrade" replace />;
  }

  if (isSubscriptionExpired(user?.clinic) && user?.role !== "admin") {
    clearAuthState();
    return <Navigate to="/login" replace />;
  }

  const hasRoleAccess = allowedRoles.includes(user.role);
  const hasPermission =
    requiredPermission &&
    (Boolean(user[requiredPermission]) ||
      (requiredPermission === "canAccessBilling" &&
        user.role === "billing_staff"));
  if (
    (allowedRoles.length > 0 || requiredPermission) &&
    !hasRoleAccess &&
    !hasPermission
  ) {
    return <Navigate to={user.role === "billing_staff" ? "/billing" : "/dashboard"} replace />;
  }

  return children;
}
