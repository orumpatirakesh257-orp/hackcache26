import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { UserRole } from '../../../shared/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  // If user is not authenticated as staff or is a patient, block access
  if (!isAuthenticated || !user || user.role === 'patient') {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}&error=auth_required`}
        replace
      />
    );
  }

  // If specific staff roles are required and user role does not match
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to="/staff"
        replace
      />
    );
  }

  return <>{children}</>;
};
