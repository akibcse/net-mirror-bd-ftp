export interface AppUser {
  uid: string;
  email: string | null;
  phoneNumber?: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'user';
  createdAt: number;
  lastLoginAt: number;

  // Login Telemetry & Geolocation
  lastIp?: string;
  lastIsp?: string;
  lastOrg?: string;
  lastAsn?: string | number;
  lastCity?: string;
  lastRegion?: string;
  lastCountry?: string;
  lastCountryCode?: string;
  lastPostal?: string;
  lastLat?: number;
  lastLon?: number;
  lastTimezone?: string;
  lastFlag?: string;
  lastDevice?: string;
  lastDeviceModel?: string;
  lastOs?: string;
  lastBrowser?: string;
  lastScreen?: string;
}
