import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import { SettingsService } from '../../services/settings.service';
import { map } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./auth.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);

  readonly registrationOpen$ = this.settingsService.settings$.pipe(
    map(s => s.registrationOpen !== false)
  );

  readonly registerForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (this.settingsService.settings.registrationOpen === false) {
      this.errorMessage.set('Public user registration is currently closed by the administrator.');
      return;
    }

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { displayName, email, password, confirmPassword } = this.registerForm.getRawValue();

    if (password !== confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.auth.register(email!, password!, displayName!);
      this.router.navigate(['/']);
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
      this.router.navigate(['/']);
    } catch (err: any) {
      this.errorMessage.set(this.formatAuthError(err));
    } finally {
      this.loading.set(false);
    }
  }

  private formatAuthError(err: any): string {
    const code = err?.code || '';
    if (code === 'auth/operation-not-allowed') {
      return 'Sign-up provider is disabled in Firebase. Please enable Email/Password in Firebase Console > Authentication > Sign-in method.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized in Firebase. Add your domain in Firebase Console > Authentication > Settings > Authorized domains.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters long.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network error. Please check your internet connection.';
    }
    return err?.message || 'Failed to create account. Please try again.';
  }
}
