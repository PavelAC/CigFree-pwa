import { Injectable, inject } from '@angular/core';
import { 
  Auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  updateProfile,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
    browserLocalPersistence,
    browserSessionPersistence,
    setPersistence
  } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  smokeFreeSince?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  public isAuthenticated$: Observable<boolean> = this.currentUser$.pipe(
    map(user => !!user)
  );

  public userProfile$ = this.currentUser$.pipe(
    switchMap(user => {
      if (!user) return from(Promise.resolve(null));
      return from(this.getUserProfileDoc(user.uid));
    })
  );

  constructor() {
    this.initializeAuthPersistence();
  }

  private async initializeAuthPersistence() {
    try {
      await setPersistence(this.auth, browserLocalPersistence);
      onAuthStateChanged(this.auth, (user) => {
        this.currentUserSubject.next(user);
      });
    } catch (error) {
      console.error('Auth persistence error:', error);
      try {
        await setPersistence(this.auth, browserSessionPersistence);
      } catch (fallbackError) {
        console.error('Fallback persistence error:', fallbackError);
      }
    }
  }
  

  async signUp(email: string, password: string, displayName?: string): Promise<User> {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      if (displayName && credential.user) {
        await updateProfile(credential.user, { displayName });
      }
      
      await this.createUserProfile(credential.user, { displayName });
      
      return credential.user;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  async login(email: string, password: string): Promise<User> {
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      return credential.user;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private async createUserProfile(user: User, additionalData?: Partial<UserProfile>): Promise<void> {
    if (!user.uid) return;

    const userRef = doc(this.firestore, `users/${user.uid}`);
    
    const userData: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || additionalData?.displayName,
      smokeFreeSince: new Date(),
      ...additionalData
    };

    try {
      await setDoc(userRef, userData);
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  async getUserProfileDoc(uid: string): Promise<UserProfile | null> {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      const docSnap = await getDoc(userRef);
      
      if (!docSnap.exists()) return null;
      
      const data = docSnap.data();
      // Convert any Firestore timestamps to Date objects
      return {
        ...data as UserProfile,
        smokeFreeSince: data['smokeFreeSince'] && typeof data['smokeFreeSince'].toDate === 'function' 
          ? data['smokeFreeSince'].toDate() 
          : data['smokeFreeSince']
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  getAuthState(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        unsubscribe();
        resolve(user);
        console.log('Auth state changed:', user);
        this.currentUserSubject.next(user);
      });
    });
  }

}