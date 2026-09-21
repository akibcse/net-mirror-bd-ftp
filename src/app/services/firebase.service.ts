import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Database, getDatabase } from 'firebase/database';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  public readonly app: FirebaseApp;
  public readonly auth: Auth;
  public readonly firestore: Firestore;
  public readonly db: Database;

  constructor() {
    this.app = getApps().length > 0 ? getApps()[0] : initializeApp(environment.firebase);
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);
    const rtdbUrl = (environment.firebase as any).databaseURL
      || `https://${environment.firebase.projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`;
    try {
      this.db = getDatabase(this.app, rtdbUrl);
    } catch {
      this.db = getDatabase(this.app);
    }
  }
}
