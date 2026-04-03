import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  FormsModule,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

// Custom validator: password match
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirm = control.get('confirmPassword');
  if (password && confirm && password.value !== confirm.value) {
    confirm.setErrors({ mismatch: true });
    return { mismatch: true };
  } else {
    if (confirm?.errors?.['mismatch']) {
      confirm.setErrors(null);
    }
    return null;
  }
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule,ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {

  // ── Step control ──────────────────────────────────────
  // step 1 = form  |  step 2 = OTP screen  |  step 3 = success
  step = 1;

  registerForm!: FormGroup;

  otp = '';
  isEmailVerified = false;

  showPassword = false;
  showConfirm  = false;
  captchaChecked = false;

  isLoading   = false;
  otpLoading  = false;
  errorMessage  = '';
  successMessage = '';

  // ── API base (proxy → gateway → /api/user/auth) ───────
  private readonly BASE = '/Auth';

  constructor(
    private fb:     FormBuilder,
    private http:   HttpClient,
    private router: Router,
    private cdr:    ChangeDetectorRef
  ) {
    this.registerForm = this.fb.group(
      {
        firstName:       ['', [Validators.required, Validators.minLength(2)]],
        lastName:        ['', [Validators.required, Validators.minLength(2)]],
        mobileNo:        ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
        email:           ['', [Validators.required, Validators.email]],
        password:        ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator }
    );

    this.registerForm.valueChanges.subscribe(() => {
      this.errorMessage = '';
    });
  }

  // ── Helpers ───────────────────────────────────────────
  f(name: string) { return this.registerForm.get(name); }

  // ── Step 1 → Send OTP ─────────────────────────────────
  sendOtp() {
    const emailCtrl = this.f('email');
    emailCtrl?.markAsTouched();
    if (emailCtrl?.invalid) return;

    this.otpLoading = true;
    this.errorMessage = '';

    this.http
      .post(`${this.BASE}/send-email-otp`, { email: emailCtrl!.value })
      .pipe(finalize(() => { this.otpLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.step = 2;
          this.successMessage = `OTP sent to ${emailCtrl!.value}`;
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Failed to send OTP. Try again.';
        }
      });
  }

  // ── Step 2 → Verify OTP ───────────────────────────────
  verifyOtp() {
    if (!this.otp.trim()) { this.errorMessage = 'Please enter the OTP.'; return; }

    this.otpLoading = true;
    this.errorMessage = '';

    this.http
      .post(`${this.BASE}/verify-email-otp`, {
        email: this.f('email')!.value,
        otp:   this.otp.trim()
      })
      .pipe(finalize(() => { this.otpLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.isEmailVerified = true;
          this.step = 1;
          this.successMessage = '✅ Email verified! Complete your registration.';
          this.otp = '';
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Invalid or expired OTP.';
        }
      });
  }

  resendOtp() {
    this.otp = '';
    this.errorMessage = '';
    this.sendOtp();
  }

  goBackToForm() {
    this.step = 1;
    this.errorMessage = '';
    this.successMessage = '';
  }

  // ── Step 3 → Register ────────────────────────────────
  register() {
    if (this.isLoading) return;

    if (!this.isEmailVerified) {
      this.errorMessage = 'Please verify your email before registering.';
      return;
    }

    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid) return;

    if (!this.captchaChecked) {
      this.errorMessage = 'Please verify that you are not a robot.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { confirmPassword, ...payload } = this.registerForm.value;

    this.http
      .post(`${this.BASE}/register`, payload)
      .pipe(finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.step = 3;
        },
        error: (err) => {
          if (err.status === 404) {
            this.errorMessage = 'API endpoint not found. Contact support.';
          } else if (err.status === 400) {
            this.errorMessage = err.error?.message || 'Invalid data. Please check your inputs.';
          } else if (err.status === 0) {
            this.errorMessage = 'Network error. Check your connection.';
          } else {
            this.errorMessage = err.error?.message || 'Registration failed. Try again.';
          }
          this.cdr.detectChanges();
        }
      });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
