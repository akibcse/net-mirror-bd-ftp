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
      return user.role === 'admin' || this.checkIsAdmin(user.email);
    }),
    distinctUntilChanged()
  );

  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private get safeDb() { return this.firebase.db; }

  constructor() {
    // 1. Immediately hydrate auth state from localStorage cache for 0ms lag
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('netmirror_user_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.uid) {
            if (this.checkIsAdmin(parsed.email)) {
              parsed.role = 'admin';
            }
            this.currentUserSubject.next(parsed);
            this.loadingSubject.next(false);
          }
        }
      }
    } catch { /* ignore cache read error */ }

    // 2. Listen to Firebase Auth state
    this.initAuthState();
  }

  get currentUser(): AppUser | null {
    return this.currentUserSubject.value;
  }

  public checkIsAdmin(email?: string | null): boolean {
    if (!email) return false;
    const emailLower = email.trim().toLowerCase();
    const adminEmails = (environment.adminEmails || []).map(e => e.trim().toLowerCase());
    return adminEmails.includes(emailLower);
  }

  private initAuthState(): void {
    onAuthStateChanged(this.firebase.auth, (fbUser: FirebaseUser | null) => {
      this.zone.run(() => {
        if (!fbUser) {
          this.currentUserSubject.next(null);
          this.loadingSubject.next(false);
          try {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('netmirror_user_cache');
            }
          } catch { /* ignore */ }
          return;
        }

        const emailLower = fbUser.email?.trim().toLowerCase() || '';
        const isAdminConfigured = this.checkIsAdmin(emailLower);
        const role: 'admin' | 'user' = isAdminConfigured ? 'admin' : 'user';
        const defaultDisplayName = fbUser.displayName
          || (fbUser.phoneNumber ? `User ${fbUser.phoneNumber}` : (fbUser.email?.split('@')[0] || 'User'));

        const existing = this.currentUserSubject.value;
        const appUser: AppUser = {
          uid: fbUser.uid,
          email: fbUser.email || existing?.email || null,
          phoneNumber: fbUser.phoneNumber || existing?.phoneNumber || null,
          displayName: existing?.displayName || defaultDisplayName,
          photoURL: fbUser.photoURL || existing?.photoURL || null,
          role: (isAdminConfigured || existing?.role === 'admin') ? 'admin' : role,
          createdAt: existing?.createdAt || Date.now(),
          lastLoginAt: Date.now(),
          ...this.getClientTelemetry()
        };

        // Emit immediately! Never block UI on remote network queries!
        this.currentUserSubject.next(appUser);
        this.loadingSubject.next(false);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('netmirror_user_cache', JSON.stringify(appUser));
          }
        } catch { /* ignore */ }

        // Background non-blocking profile sync
        this.syncUserProfileInBackground(fbUser, appUser);
      });
    });
  }

  private async syncUserProfileInBackground(fbUser: FirebaseUser, baseUser: AppUser): Promise<void> {
    try {
      const timeout = <T>(p: Promise<T>, ms = 2500): Promise<T> =>
        Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

      let remoteData: any = null;

      // 1. Try reading from RTDB (Realtime Database primary)
      if (this.safeDb) {
        try {
          const rtdbSnap = await timeout(get(ref(this.safeDb, `users/${fbUser.uid}`)));
          if (rtdbSnap && rtdbSnap.exists()) {
            remoteData = rtdbSnap.val();
          }
        } catch { /* ignore */ }
      }

      // 2. Try Firestore fallback if not found in RTDB
      if (!remoteData) {
        try {
          const userDocRef = doc(this.firebase.firestore, 'users', fbUser.uid);
          const fsSnap = await timeout(getDoc(userDocRef));
          if (fsSnap && fsSnap.exists()) {
            remoteData = fsSnap.data();
          }
        } catch { /* ignore */ }
      }

      const isAdminConfigured = this.checkIsAdmin(fbUser.email);
      const finalRole: 'admin' | 'user' = (isAdminConfigured || remoteData?.role === 'admin' || baseUser.role === 'admin') ? 'admin' : 'user';

      const mergedUser: AppUser = {
        ...baseUser,
        ...(remoteData || {}),
        role: finalRole,
        lastLoginAt: Date.now()
      };

      const clean = cleanUndefined(mergedUser);

      // Dual-sync to RTDB
      if (this.safeDb) {
        set(ref(this.safeDb, `users/${fbUser.uid}`), clean).catch(() => {});
      }

      // Dual-sync to Firestore
      try {
        const docRef = doc(this.firebase.firestore, 'users', fbUser.uid);
        setDoc(docRef, clean, { merge: true }).catch(() => {});
      } catch { /* ignore */ }

      this.currentUserSubject.next(mergedUser);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('netmirror_user_cache', JSON.stringify(mergedUser));
        }
      } catch { /* ignore */ }
    } catch {
      // Non-blocking sync error
    }
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
    const cleanEmail = email.trim();
    const cred = await createUserWithEmailAndPassword(this.firebase.auth, cleanEmail, password);
    if (displayName) {
      try {
        await updateProfile(cred.user, { displayName });
      } catch { /* ignore */ }
    }

    const now = Date.now();
    const isAdminConfigured = this.checkIsAdmin(cleanEmail);
    const role: 'admin' | 'user' = isAdminConfigured ? 'admin' : 'user';
    const telemetry = this.getClientTelemetry();

    const user: AppUser = {
      uid: cred.user.uid,
      email: cred.user.email,
      phoneNumber: cred.user.phoneNumber || null,
      displayName: displayName || cleanEmail.split('@')[0] || 'User',
      photoURL: null,
      role,
      createdAt: now,
      lastLoginAt: now,
      ...telemetry
    };

    // Instant local state update
    this.currentUserSubject.next(user);
    this.loadingSubject.next(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('netmirror_user_cache', JSON.stringify(user));
      }
    } catch { /* ignore */ }

    // Save to RTDB and Firestore
    const cleanUser = cleanUndefined(user);
    if (this.safeDb) {
      set(ref(this.safeDb, `users/${user.uid}`), cleanUser).catch(() => {});
    }
    try {
      const docRef = doc(this.firebase.firestore, 'users', user.uid);
      setDoc(docRef, cleanUser).catch(() => {});
    } catch { /* ignore */ }

    return user;
  }

  async login(email: string, password: string): Promise<AppUser> {
    const cleanEmail = email.trim();
    const cred = await signInWithEmailAndPassword(this.firebase.auth, cleanEmail, password);
    const fbUser = cred.user;
    const isAdmin = this.checkIsAdmin(fbUser.email || cleanEmail);
    const appUser: AppUser = {
      uid: fbUser.uid,
      email: fbUser.email || cleanEmail,
      phoneNumber: fbUser.phoneNumber || null,
      displayName: fbUser.displayName || cleanEmail.split('@')[0] || 'User',
      photoURL: fbUser.photoURL || null,
      role: isAdmin ? 'admin' : 'user',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      ...this.getClientTelemetry()
    };

    // Instant emission
    this.currentUserSubject.next(appUser);
    this.loadingSubject.next(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('netmirror_user_cache', JSON.stringify(appUser));
      }
    } catch { /* ignore */ }

    this.syncUserProfileInBackground(fbUser, appUser);
    return appUser;
  }

  async loginWithGoogle(): Promise<AppUser> {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.firebase.auth, provider);
    const fbUser = cred.user;
    const isAdmin = this.checkIsAdmin(fbUser.email);
    const appUser: AppUser = {
      uid: fbUser.uid,
      email: fbUser.email || null,
      phoneNumber: fbUser.phoneNumber || null,
      displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
      photoURL: fbUser.photoURL || null,
      role: isAdmin ? 'admin' : 'user',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      ...this.getClientTelemetry()
    };

    this.currentUserSubject.next(appUser);
    this.loadingSubject.next(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('netmirror_user_cache', JSON.stringify(appUser));
      }
    } catch { /* ignore */ }

    this.syncUserProfileInBackground(fbUser, appUser);
    return appUser;
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
  async verifyPhoneOtp(confirmationResult: ConfirmationResult, verificationCode: string): Promise<AppUser> {
    const cred = await confirmationResult.confirm(verificationCode);
    const fbUser = cred.user;
    const isAdmin = this.checkIsAdmin(fbUser.email);
    const appUser: AppUser = {
      uid: fbUser.uid,
      email: fbUser.email || null,
      phoneNumber: fbUser.phoneNumber || null,
      displayName: fbUser.displayName || fbUser.phoneNumber || 'User',
      photoURL: fbUser.photoURL || null,
      role: isAdmin ? 'admin' : 'user',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      ...this.getClientTelemetry()
    };

    this.currentUserSubject.next(appUser);
    this.loadingSubject.next(false);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('netmirror_user_cache', JSON.stringify(appUser));
      }
    } catch { /* ignore */ }

    this.syncUserProfileInBackground(fbUser, appUser);
    return appUser;
  }

  async logout(): Promise<void> {
    this.clearRecaptcha();
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('netmirror_user_cache');
      }
    } catch { /* ignore */ }
    this.currentUserSubject.next(null);
    try {
      await signOut(this.firebase.auth);
    } catch { /* ignore */ }
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
    if (this.safeDb) {
      try {
        const userRef = ref(this.safeDb, `users/${uid}`);
        await update(userRef, { role });
      } catch { /* ignore */ }
    }

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
    if (this.safeDb) {
      try {
        const userRef = ref(this.safeDb, `users/${uid}`);
        await update(userRef, clean);
      } catch { /* ignore */ }
    }

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
    if (this.safeDb) {
      try {
        const userRef = ref(this.safeDb, `users/${uid}`);
        await remove(userRef);
      } catch { /* ignore */ }
    }
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
    if (this.safeDb) {
      try {
        const userRef = ref(this.safeDb, `users/${user.uid}`);
        await update(userRef, clean);
      } catch { /* ignore */ }
    }

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

