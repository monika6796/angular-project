import { AuthService } from '../services/auth.service';
import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const token = localStorage.getItem('token');

  // ✅ sirf valid token pe redirect karo
  if (token && authService.isTokenValid(token)) {
    return router.createUrlTree(['/home/dashboard']);
  }

  return true;
};