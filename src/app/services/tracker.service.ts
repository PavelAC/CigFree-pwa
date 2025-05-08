import { Injectable, inject } from '@angular/core';
import { doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Timestamp } from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';

interface UserProfile {
  uid: string;
  smokeFreeSince?: Date | Timestamp;
  email: string;
  displayName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TrackerService {
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  
  get smokeFreeDays$(): Observable<number> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user?.uid) return of(0);
        
        return this.getUserProfile(user.uid).pipe(
          map(profile => this.calculateDaysFromProfile(profile)),
          catchError(() => of(0))
        );
      })
    );
  }

  private getUserProfile(uid: string): Observable<UserProfile | null> {
    // Use FirestoreService for document retrieval with offline support
    return from(this.firestoreService.getDocument<UserProfile>('users', uid));
  }

  private calculateDaysFromProfile(profile: UserProfile | null): number {
    if (!profile?.smokeFreeSince) return 0;
    
    const quitDate = this.convertFirestoreDate(profile.smokeFreeSince);
    return this.calculateDaysDifference(quitDate);
  }

  private convertFirestoreDate(date: Date | Timestamp): Date {
    return date instanceof Timestamp ? date.toDate() : date;
  }

  private calculateDaysDifference(startDate: Date): number {
    const now = new Date();
    const diffInMs = now.getTime() - startDate.getTime();
    return Math.max(0, Math.floor(diffInMs / (1000 * 60 * 60 * 24)));
  }

  // We don't need the offline data key anymore since FirestoreService handles that
  async resetCounter(): Promise<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user?.uid) return false;
  
    try {
      // Use FirestoreService for document updates with offline support
      return await this.firestoreService.updateDocument<UserProfile>(
        'users', 
        user.uid, 
        { smokeFreeSince: new Date() }
      );
    } catch (error) {
      console.error('Failed to reset counter:', error);
      return false;
    }
  }
}