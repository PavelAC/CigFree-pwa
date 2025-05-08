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
  

    private readonly OFFLINE_DATA_KEY = 'offline_tracker_data';

async resetCounter(): Promise<boolean> {
  const user = this.authService.getCurrentUser();
  if (!user?.uid) return false;

  if (!navigator.onLine) {
    const actions = [{
      type: 'resetCounter',
      timestamp: new Date().toISOString()
    }];
    
    localStorage.setItem(this.OFFLINE_DATA_KEY, JSON.stringify(actions));
    return true;
  }

  try {
    const userRef = doc(this.firestore, `users/${user.uid}`);
    
    await updateDoc(userRef, {
      smokeFreeSince: new Date()
    });
    
    return true;
  } catch (error) {
    console.error('Failed to reset counter:', error);
    return false;
  }
}

    private async syncOfflineActions(): Promise<void> {
      const storedData = localStorage.getItem(this.OFFLINE_DATA_KEY);
      const actions = storedData ? JSON.parse(storedData) : [];
      
      if (!actions.length) return;
    
      try {
        const user = this.authService.getCurrentUser();
        if (!user?.uid) return;
    
        const userRef = doc(this.firestore, `users/${user.uid}`);
        const docSnap = await getDoc(userRef);
        
        if (!docSnap.exists()) return;
        
        // Process actions in chronological order
        actions.sort((a: { timestamp: string }, b: { timestamp: string }) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // Get current smoke-free date
        let userData = docSnap.data() as UserProfile;
        let currentDate = userData.smokeFreeSince instanceof Timestamp 
          ? userData.smokeFreeSince.toDate() 
          : userData.smokeFreeSince 
            ? new Date(userData.smokeFreeSince) 
            : new Date();
        
        // Apply each action
        for (const action of actions) {
          if (action.type === 'resetCounter') {
            // For reset, just use the timestamp directly
            currentDate = new Date(action.timestamp);
          } else if (action.type === 'addDay') {
            // For add day, subtract one day from the current date
            currentDate.setDate(currentDate.getDate() - 1);
          }
        }
        
        // Update with final calculated date
        await updateDoc(userRef, {
          smokeFreeSince: currentDate
        });
        
        localStorage.removeItem(this.OFFLINE_DATA_KEY);
      } catch (error) {
        console.error('Failed to sync offline actions:', error);
      }
    
        
        localStorage.removeItem(this.OFFLINE_DATA_KEY);
      } catch (error: unknown) {
        console.error('Failed to sync offline actions:', error);
      }
    

    async addOneDay(): Promise<boolean> {
      const user = this.authService.getCurrentUser();
      if (!user?.uid) return false;
    
      if (!navigator.onLine) {
        // Handle offline mode using the same approach as resetCounter
        const storedData = localStorage.getItem(this.OFFLINE_DATA_KEY);
        const actions = storedData ? JSON.parse(storedData) : [];
        
        // Get the current date and subtract one day to store as action
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        actions.push({
          type: 'addDay',
          timestamp: new Date().toISOString()
        });
        
        localStorage.setItem(this.OFFLINE_DATA_KEY, JSON.stringify(actions));
        return true;
      }
      
      try {
        // Get the current user profile
        const userRef = doc(this.firestore, `users/${user.uid}`);
        const docSnap = await getDoc(userRef);
        
        if (!docSnap.exists()) return false;
        
        const userData = docSnap.data() as UserProfile;
        
        if (!userData.smokeFreeSince) {
          // If no smoke-free date exists, set it to yesterday
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          
          await updateDoc(userRef, {
            smokeFreeSince: yesterday
          });
          
          return true;
        } else {
          // Get the current quit date
          const smokeFreeSince = userData.smokeFreeSince instanceof Timestamp 
            ? userData.smokeFreeSince.toDate() 
            : new Date(userData.smokeFreeSince);
            
          // Subtract one more day (move the date back)
          smokeFreeSince.setDate(smokeFreeSince.getDate() - 1);
          
          // Update in Firestore
          await updateDoc(userRef, {
            smokeFreeSince: smokeFreeSince
          });
          
          return true;
        }
      } catch (error: unknown) {
        console.error('Failed to add one day:', error);
        return false;
      }
    }
}