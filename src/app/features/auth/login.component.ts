import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./auth.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly selectedTab = signal<'email' | 'phone'>('email');
  readonly phoneStep = signal<'input' | 'verify'>('input');
  readonly phoneCountryCode = signal<string>('+880');
  readonly rawPhoneNumber = signal<string>('');
  readonly otpCode = signal<string>('');

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly accessDeniedNotice = signal(
    this.route.snapshot.queryParams['accessDenied'] === 'admin-only'
  );

  private confirmationResult: ConfirmationResult | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;

  ngOnInit(): void {
    const tabParam = this.route.snapshot.queryParams['tab'];
    if (tabParam === 'phone') {
      this.selectedTab.set('phone');
    }
  }

  ngOnDestroy(): void {
    this.auth.clearRecaptcha();
  }

  setTab(tab: 'email' | 'phone'): void {
    this.selectedTab.set(tab);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.getRawValue();

    try {
      await this.auth.login(email!, password!);
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
      this.router.navigateByUrl(returnUrl);
    } catch (err: any) {
      this.errorMessage.set(this.formatAuthError(err));
    } finally {
      this.loading.set(false);
    }
  }

  async onGoogleSignIn(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.auth.loginWithGoogle();
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
      this.router.navigateByUrl(returnUrl);
    } catch (err: any) {
      this.errorMessage.set(this.formatAuthError(err));
    } finally {
      this.loading.set(false);
    }
  }

  get fullPhoneNumber(): string {
    let cleanNumber = this.rawPhoneNumber().trim().replace(/^0+/, '');
    return `${this.phoneCountryCode()}${cleanNumber}`;
  }

  async onSendOtp(): Promise<void> {
    const raw = this.rawPhoneNumber().trim();
    if (!raw) {
      this.errorMessage.set('Please enter a valid phone number.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const fullPhone = this.fullPhoneNumber;
      this.recaptchaVerifier = this.auth.initRecaptcha('recaptcha-container');
      this.confirmationResult = await this.auth.sendPhoneOtp(fullPhone, this.recaptchaVerifier);
      this.phoneStep.set('verify');
      this.successMessage.set(`6-digit verification code sent to ${fullPhone}`);
    } catch (err: any) {
      this.errorMessage.set(this.formatAuthError(err));
    } finally {
      this.loading.set(false);
    }
  }

  async onVerifyOtp(): Promise<void> {
    const code = this.otpCode().trim();
    if (!code || code.length < 6) {
      this.errorMessage.set('Please enter the 6-digit code sent via SMS.');
      return;
    }

    if (!this.confirmationResult) {
      this.errorMessage.set('Session expired. Please request a new verification code.');
      this.phoneStep.set('input');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.auth.verifyPhoneOtp(this.confirmationResult, code);
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
      this.router.navigateByUrl(returnUrl);
    } catch (err: any) {
      this.errorMessage.set(this.formatAuthError(err));
    } finally {
      this.loading.set(false);
    }
  }

  onResetPhone(): void {
    this.phoneStep.set('input');
    this.otpCode.set('');
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.auth.clearRecaptcha();
  }

  private formatAuthError(err: any): string {
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password. Please try again.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many attempts. Please try again in a few moments.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in was cancelled.';
    }
    if (code === 'auth/invalid-phone-number') {
      return 'Invalid phone number format. Please check your country code and number.';
    }
    if (code === 'auth/invalid-verification-code') {
      return 'Incorrect verification code. Please check your SMS and try again.';
    }
    if (code === 'auth/code-expired') {
      return 'The SMS code has expired. Please request a new one.';
    }
    if (code === 'auth/captcha-check-failed') {
      return 'reCAPTCHA verification failed. Please try again.';
    }
    if (code === 'auth/quota-exceeded') {
      return 'SMS quota exceeded for today. Please sign in using Google or Email/Password.';
    }
    return err?.message || 'Authentication failed. Please try again.';
  }
}

