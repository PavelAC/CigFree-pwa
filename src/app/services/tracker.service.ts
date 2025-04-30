import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Timestamp } from '@angular/fire/firestore';

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
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
  
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
      const userDocRef = doc(this.firestore, `users/${uid}`);
      return from(getDoc(userDocRef)).pipe(
        map(docSnap => docSnap.exists() ? (docSnap.data() as UserProfile) : null)
      );
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
  
    async resetCounter(): Promise<void> {
      const user = this.authService.getCurrentUser();
      if (!user?.uid) return;
  
      try {
        const userRef = doc(this.firestore, `users/${user.uid}`);
        await updateDoc(userRef, {
          smokeFreeSince: new Date()
        });
      } catch (error) {
        console.error('Error resetting counter:', error);
        throw error;
      }
    }
}