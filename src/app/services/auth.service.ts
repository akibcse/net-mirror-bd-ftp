import { Injectable, inject, NgZone } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  User as FirebaseUser
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot
} from 'firebase/firestore';
import { ref, set, get, update, remove, onValue, off } from 'firebase/database';
import { BehaviorSubject, Observable, map, distinctUntilChanged } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { AppUser } from '../models/user.model';
import { environment } from '../../environments/environment';

function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        result[key] = cleanUndefined(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly firebase = inject(FirebaseService);
  private readonly zone = inject(NgZone);

  private readonly currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  public readonly currentUser$ = this.currentUserSubject.asObservable();

  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  public readonly loading$ = this.loadingSubject.asObservable();

  public readonly isAuthenticated$: Observable<boolean> = this.currentUser$.pipe(
    map(user => !!user)
  );

  public readonly isAdmin$: Observable<boolean> = this.currentUser$.pipe(
    map(user => {
      if (!user) return false;
      const emailLower = user.email?.toLowerCase() || '';
      const isConfiguredAdmin = environment.adminEmails?.map(e => e.toLowerCase()).includes(emailLower);
      return user.role === 'admin' || !!isConfiguredAdmin;
    }),
    distinctUntilChanged()
  );

  private recaptchaVerifier: RecaptchaVerifier | null = null;

  constructor() {
    this.initAuthState();
  }

  get currentUser(): AppUser | null {
    return this.currentUserSubject.value;
  }

  private initAuthState(): void {
    onAuthStateChanged(this.firebase.auth, (fbUser: FirebaseUser | null) => {
      this.zone.run(async () => {
        if (!fbUser) {
          this.currentUserSubject.next(null);
          this.loadingSubject.next(false);
          return;
        }

        try {
          const now = Date.now();
          const emailLower = fbUser.email?.toLowerCase() || '';
          const isAdminConfigured = environment.adminEmails?.map(e => e.toLowerCase()).includes(emailLower);
          const telemetry = this.getClientTelemetry();

          // 1. Try reading existing profile from Firestore
          let existingData: any = null;
          try {
            const userDocRef = doc(this.firebase.firestore, 'users', fbUser.uid);
            const fsSnap = await getDoc(userDocRef);
            if (fsSnap.exists()) {
              existingData = fsSnap.data();
            }
          } catch (fsErr) {
            console.warn('Firestore user fetch notice (fallback checking RTDB):', fsErr);
          }

          // Fallback to RTDB if not found in Firestore
          if (!existingData) {
            try {
              const rtdbRef = ref(this.firebase.db, `users/${fbUser.uid}`);
              const rtdbSnap = await get(rtdbRef);
              if (rtdbSnap.exists()) {
                existingData = rtdbSnap.val();
              }
            } catch { /* ignore */ }
          }

          const role: 'admin' | 'user' = (isAdminConfigured || existingData?.role === 'admin') ? 'admin' : 'user';
          const defaultDisplayName = fbUser.displayName || existingData?.displayName || (fbUser.phoneNumber ? `User ${fbUser.phoneNumber}` : (fbUser.email?.split('@')[0] || 'User'));

          const appUser: AppUser = {
            uid: fbUser.uid,
            email: fbUser.email || existingData?.email || null,
            phoneNumber: fbUser.phoneNumber || existingData?.phoneNumber || null,
            displayName: defaultDisplayName,
            photoURL: fbUser.photoURL || existingData?.photoURL || null,
            role,
            createdAt: existingData?.createdAt || now,
            lastLoginAt: now,
            ...telemetry
          };

          const cleanUser = cleanUndefined(appUser);

          // Save to Firestore
          try {
            const userDocRef = doc(this.firebase.firestore, 'users', fbUser.uid);
            await setDoc(userDocRef, cleanUser, { merge: true });
          } catch (fsErr) {
            console.warn('Error syncing user profile to Firestore:', fsErr);
          }

          // Dual-sync to RTDB for backward compatibility
          try {
            const rtdbRef = ref(this.firebase.db, `users/${fbUser.uid}`);
            await set(rtdbRef, cleanUser);
          } catch { /* ignore */ }

          this.currentUserSubject.next(appUser);
        } catch (err) {
          console.error('Error syncing user profile with database:', err);
          const emailLower = fbUser.email?.toLowerCase() || '';
          const isAdminConfigured = environment.adminEmails?.map(e => e.toLowerCase()).includes(emailLower);
          const role: 'admin' | 'user' = isAdminConfigured ? 'admin' : 'user';

          this.currentUserSubject.next({
            uid: fbUser.uid,
            email: fbUser.email,
            phoneNumber: fbUser.phoneNumber || null,
            displayName: fbUser.displayName || fbUser.phoneNumber || 'User',
            photoURL: fbUser.photoURL,
            role,
            createdAt: Date.now(),
            lastLoginAt: Date.now()
          });
        } finally {
          this.loadingSubject.next(false);
        }
      });
    });
  }

  private getClientTelemetry(): Partial<AppUser> {
    let geo: any = null;
    try {
      const stored = sessionStorage.getItem('netmirrorbd_cached_geo_v2');
      if (stored) geo = JSON.parse(stored);
    } catch { /* ignore */ }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Mobile|Android|iPhone/i.test(ua);
    const isTablet = /iPad|Tablet/i.test(ua);
    const dev = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
    const os = /Win/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : 'Linux';
    const browser = /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Browser';
    const screen = typeof window !== 'undefined' ? `${window.screen.width}×${window.screen.height}` : undefined;

    const res: Partial<AppUser> = {
      lastDevice: dev,
      lastOs: os,
      lastBrowser: browser,
      lastScreen: screen
    };

    if (geo?.ip && geo.ip !== 'Detecting...') res.lastIp = geo.ip;
    if (geo?.isp || geo?.org) res.lastIsp = geo.isp || geo.org;
    if (geo?.org) res.lastOrg = geo.org;
    if (geo?.asn) res.lastAsn = geo.asn;
    if (geo?.city) res.lastCity = geo.city;
    if (geo?.region) res.lastRegion = geo.region;
    if (geo?.country) res.lastCountry = geo.country;
    if (geo?.countryCode) res.lastCountryCode = geo.countryCode;
    if (geo?.postal) res.lastPostal = geo.postal;
    if (geo?.latitude) res.lastLat = geo.latitude;
    if (geo?.longitude) res.lastLon = geo.longitude;
    if (geo?.timezone) res.lastTimezone = geo.timezone;
    if (geo?.flag) res.lastFlag = geo.flag;

    return res;
  }

  async register(email: string, password: string, displayName: string): Promise<AppUser> {
    const cred = await createUserWithEmailAndPassword(this.firebase.auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }

    const now = Date.now();
    const isAdminConfigured = environment.adminEmails?.includes(email.toLowerCase());
    const role: 'admin' | 'user' = isAdminConfigured ? 'admin' : 'user';
    const telemetry = this.getClientTelemetry();

    const user: AppUser = {
      uid: cred.user.uid,
      email: cred.user.email,
      phoneNumber: cred.user.phoneNumber || null,
      displayName: displayName || cred.user.email?.split('@')[0] || 'User',
      photoURL: null,
      role,
      createdAt: now,
      lastLoginAt: now,
      ...telemetry
    };

    const cleanUser = cleanUndefined(user);

    // Save to Firestore
    try {
      const docRef = doc(this.firebase.firestore, 'users', user.uid);
      await setDoc(docRef, cleanUser);
    } catch (fsErr) {
      console.warn('Firestore register write notice:', fsErr);
    }

    // Save to RTDB
    try {
      await set(ref(this.firebase.db, `users/${user.uid}`), cleanUser);
    } catch { /* ignore */ }

    this.currentUserSubject.next(user);
    return user;
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.firebase.auth, email, password);
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.firebase.auth, provider);
  }

  /**
   * Initialize reCAPTCHA verifier for Phone Auth
   */
  initRecaptcha(containerId: string): RecaptchaVerifier {
    if (typeof window === 'undefined') return null as any;
    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.clear();
      } catch { /* ignore */ }
    }
    this.recaptchaVerifier = new RecaptchaVerifier(this.firebase.auth, containerId, {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => {
        console.warn('Phone auth reCAPTCHA expired.');
      }
    });
    return this.recaptchaVerifier;
  }

  /**
   * Clear active reCAPTCHA instance
   */
  clearRecaptcha(): void {
    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.clear();
      } catch { /* ignore */ }
      this.recaptchaVerifier = null;
    }
  }

  /**
   * Send SMS OTP verification code to a phone number
   */
  async sendPhoneOtp(phoneNumber: string, appVerifier?: RecaptchaVerifier): Promise<ConfirmationResult> {
    const verifier = appVerifier || this.recaptchaVerifier;
    if (!verifier) {
      throw new Error('reCAPTCHA verifier not initialized.');
    }
    return await signInWithPhoneNumber(this.firebase.auth, phoneNumber, verifier);
  }

  /**
   * Confirm phone OTP verification code
   */
  async verifyPhoneOtp(confirmationResult: ConfirmationResult, verificationCode: string): Promise<void> {
    await confirmationResult.confirm(verificationCode);
  }

  async logout(): Promise<void> {
    this.clearRecaptcha();
    await signOut(this.firebase.auth);
    this.currentUserSubject.next(null);
  }

  getAllUsers(): Observable<AppUser[]> {
    return new Observable<AppUser[]>(observer => {
      // 1. Listen from Firestore collection 'users'
      try {
        const usersCol = collection(this.firebase.firestore, 'users');
        const unsubscribe = onSnapshot(
          usersCol,
          snapshot => {
            this.zone.run(() => {
              const users: AppUser[] = [];
              snapshot.forEach(docSnap => {
                users.push(docSnap.data() as AppUser);
              });
              users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
              observer.next(users);
            });
          },
          firestoreError => {
            console.warn('Firestore users listener error, falling back to RTDB:', firestoreError);
            try {
              const usersRef = ref(this.firebase.db, 'users');
              const listener = onValue(
                usersRef,
                rtdbSnap => {
                  this.zone.run(() => {
                    if (rtdbSnap.exists()) {
                      const data = rtdbSnap.val();
                      const users: AppUser[] = Object.values(data);
                      users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                      observer.next(users);
                    } else {
                      observer.next([]);
                    }
                  });
                },
                rtdbError => this.zone.run(() => observer.error(rtdbError))
              );
            } catch (e) {
              observer.error(e);
            }
          }
        );

        return () => unsubscribe();
      } catch (e) {
        // Fallback to RTDB
        const usersRef = ref(this.firebase.db, 'users');
        const listener = onValue(
          usersRef,
          rtdbSnap => {
            this.zone.run(() => {
              if (rtdbSnap.exists()) {
                const data = rtdbSnap.val();
                const users: AppUser[] = Object.values(data);
                users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                observer.next(users);
              } else {
                observer.next([]);
              }
            });
          },
          rtdbError => this.zone.run(() => observer.error(rtdbError))
        );
        return () => off(usersRef, 'value', listener);
      }
    });
  }

  async updateUserRole(uid: string, role: 'admin' | 'user'): Promise<void> {
    try {
      const docRef = doc(this.firebase.firestore, 'users', uid);
      await updateDoc(docRef, { role });
    } catch (e) {
      console.warn('Firestore role update error:', e);
    }
    try {
      const userRef = ref(this.firebase.db, `users/${uid}`);
      await update(userRef, { role });
    } catch { /* ignore */ }

    if (this.currentUserSubject.value?.uid === uid) {
      this.currentUserSubject.next({
        ...this.currentUserSubject.value,
        role
      });
    }
  }

  async updateUserData(uid: string, data: Partial<AppUser>): Promise<void> {
    const clean = cleanUndefined(data);
    try {
      const docRef = doc(this.firebase.firestore, 'users', uid);
      await updateDoc(docRef, clean);
    } catch (e) {
      console.warn('Firestore updateUserData error:', e);
    }
    try {
      const userRef = ref(this.firebase.db, `users/${uid}`);
      await update(userRef, clean);
    } catch { /* ignore */ }

    if (this.currentUserSubject.value?.uid === uid) {
      this.currentUserSubject.next({
        ...this.currentUserSubject.value,
        ...data
      });
    }
  }

  async deleteUser(uid: string): Promise<void> {
    try {
      const docRef = doc(this.firebase.firestore, 'users', uid);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Firestore deleteUser error:', e);
    }
    try {
      const userRef = ref(this.firebase.db, `users/${uid}`);
      await remove(userRef);
    } catch { /* ignore */ }
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.firebase.auth, email);
  }

  async updateProfileData(displayName: string, photoURL?: string): Promise<void> {
    const user = this.firebase.auth.currentUser;
    if (!user) throw new Error('Not logged in');
    await updateProfile(user, { displayName, photoURL });
    const clean = cleanUndefined({ displayName, photoURL: photoURL || null });
    try {
      const docRef = doc(this.firebase.firestore, 'users', user.uid);
      await updateDoc(docRef, clean);
    } catch (e) {
      console.warn('Firestore profile update error:', e);
    }
    try {
      const userRef = ref(this.firebase.db, `users/${user.uid}`);
      await update(userRef, clean);
    } catch { /* ignore */ }

    if (this.currentUserSubject.value) {
      this.currentUserSubject.next({
        ...this.currentUserSubject.value,
        displayName,
        photoURL: photoURL || null
      });
    }
  }

  async changePassword(newPassword: string): Promise<void> {
    const user = this.firebase.auth.currentUser;
    if (!user) throw new Error('Not logged in');
    await updatePassword(user, newPassword);
  }
}

