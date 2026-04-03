import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  loginForm!: FormGroup;
  errorMessage = '';
  isLoading = false;
  showPassword = false;
  rememberMe = false;
  captchaChecked = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    // ✅ Auto remove error when user types
    this.loginForm.valueChanges.subscribe(() => {
      this.errorMessage = '';
    });
  }

  login() {

  if (this.isLoading) return;

  if (this.loginForm.invalid) {
    this.loginForm.markAllAsTouched();
    return;
  }

  if (!this.captchaChecked) {
    this.errorMessage = 'Please verify that you are not a robot.';
    return;
  }

  this.isLoading = true;
  this.errorMessage = '';

  this.authService.login(this.loginForm.value)
    .pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges(); // ✅ FIX
      })
    )
    .subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.accessToken);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        if (err.status === 504) {
          this.errorMessage = 'Server timeout. Try again later.';
        } else if (err.status === 401) {
          this.errorMessage = 'Invalid email or password.';
        } else if (err.status === 0) {
          this.errorMessage = 'Network error.';
        } else {
          this.errorMessage = 'Something went wrong.';
        }

        this.cdr.detectChanges(); 
      }
    });
}
}