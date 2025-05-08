import { Injectable, inject } from '@angular/core';
import { doc, getDoc, updateDoc, Firestore, Timestamp } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { NotificationService } from './notification.service';

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
  private firestore = inject(Firestore);
  private notificationService = inject(NotificationService);
  
  // Offline data key for localStorage
  private OFFLINE_DATA_KEY = 'tracker_offline_actions';
  
  constructor() {
    // Add listener for online status to trigger sync
    window.addEventListener('online', () => {
      console.log('Device came online, syncing offline actions');
      this.syncOfflineActions();
    });
  }
  
  get smokeFreeDays$(): Observable<number> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user?.uid) return of(0);
        
        return from(this.getUserProfile(user.uid)).pipe(
          map(profile => this.calculateDaysFromProfile(profile)),
          catchError(() => of(0))
        );
      })
    );
  }

  private async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      const docSnap = await getDoc(userRef);
      
      if (!docSnap.exists()) return null;
      
      return docSnap.data() as UserProfile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  private calculateDaysFromProfile(profile: UserProfile | null): number {
    if (!profile?.smokeFreeSince) return 0;
    
    const quitDate = profile.smokeFreeSince instanceof Timestamp 
      ? profile.smokeFreeSince.toDate() 
      : new Date(profile.smokeFreeSince);
    
    return this.calculateDaysDifference(quitDate);
  }

  private calculateDaysDifference(startDate: Date): number {
    const now = new Date();
    const diffInMs = now.getTime() - startDate.getTime();
    return Math.max(0, Math.floor(diffInMs / (1000 * 60 * 60 * 24)));
  }

  async resetCounter(): Promise<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user?.uid) return false;

    if (!navigator.onLine) {
      // Handle offline mode
      const actions = [{
        type: 'resetCounter',
        timestamp: new Date().toISOString()
      }];
      
      localStorage.setItem(this.OFFLINE_DATA_KEY, JSON.stringify(actions));
      
      // Show offline notification
      this.notificationService.showNotification(
        'Counter Reset (Offline Mode)', 
        { 
          body: 'Counter reset will sync when youre back online',
          icon: 'icons/icon-192x192.png'
        }
      );
      
      return true;
    }

    try {
      const userRef = doc(this.firestore, `users/${user.uid}`);
      
      // Reset to current date (today)
      await updateDoc(userRef, {
        smokeFreeSince: new Date()
      });
      
      // Show reset notification
      this.notificationService.showNotification(
        'Counter Reset', 
        { 
          body: 'Your smoke-free counter has been reset to zero',
          icon: 'icons/icon-192x192.png'
        }
      );
      
      return true;
    } catch (error) {
      console.error('Failed to reset counter:', error);
      return false;
    }
  }

  async addOneDay(): Promise<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user?.uid) return false;

    if (!navigator.onLine) {
      // Handle offline mode
      const storedData = localStorage.getItem(this.OFFLINE_DATA_KEY);
      const actions = storedData ? JSON.parse(storedData) : [];
      
      actions.push({
        type: 'addDay',
        timestamp: new Date().toISOString()
      });
      
      localStorage.setItem(this.OFFLINE_DATA_KEY, JSON.stringify(actions));
      
      // Show offline notification
      this.notificationService.showNotification(
        'Day Added (Offline Mode)', 
        { 
          body: 'Changes will sync when youre back online',
          icon: 'icons/icon-192x192.png'
        }
      );
      
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
      }
      
      // Show success notification
      this.notificationService.showNotification(
        'Day Added Successfully', 
        { 
          body: 'One day has been added to your smoke-free counter',
          icon: 'icons/icon-192x192.png'
        }
      );
      
      return true;
    } catch (error) {
      console.error('Failed to add one day:', error);
      return false;
    }
  }

  // This method is crucial for offline synchronization
  public async syncOfflineActions(): Promise<void> {
    console.log('Checking for offline actions to sync...');
    
    const storedData = localStorage.getItem(this.OFFLINE_DATA_KEY);
    if (!storedData) {
      console.log('No offline actions to sync');
      return;
    }
    
    const actions = JSON.parse(storedData);
    if (!actions.length) {
      console.log('No offline actions to sync (empty array)');
      return;
    }
    
    console.log(`Found ${actions.length} offline actions to sync`);

    try {
      const user = this.authService.getCurrentUser();
      if (!user?.uid) {
        console.log('No user logged in, cannot sync');
        return;
      }

      const userRef = doc(this.firestore, `users/${user.uid}`);
      const docSnap = await getDoc(userRef);
      
      if (!docSnap.exists()) {
        console.log('User document does not exist, cannot sync');
        return;
      }
      
      // Process actions in chronological order
      actions.sort((a: {timestamp: string}, b: {timestamp: string}) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Get current smoke-free date
      const userData = docSnap.data() as UserProfile;
      let currentDate = userData.smokeFreeSince instanceof Timestamp 
        ? userData.smokeFreeSince.toDate() 
        : userData.smokeFreeSince 
          ? new Date(userData.smokeFreeSince) 
          : new Date();
      
      console.log('Current smoke-free date before sync:', currentDate);
      
      // Apply each action
      for (const action of actions) {
        console.log(`Processing offline action: ${action.type} from ${action.timestamp}`);
        if (action.type === 'resetCounter') {
          // For reset, just use the timestamp directly
          currentDate = new Date(action.timestamp);
        } else if (action.type === 'addDay') {
          // For add day, subtract one day from the current date
          currentDate.setDate(currentDate.getDate() - 1);
        }
      }
      
      console.log('New smoke-free date after sync:', currentDate);
      
      // Update with final calculated date
      await updateDoc(userRef, {
        smokeFreeSince: currentDate
      });
      
      // Clear offline data
      localStorage.removeItem(this.OFFLINE_DATA_KEY);
      
      // Show sync notification
      this.notificationService.showNotification(
        'Offline Changes Synced', 
        { 
          body: `${actions.length} offline changes have been synchronized`,
          icon: 'icons/icon-192x192.png'
        }
      );
      
      console.log('Offline actions synced successfully');
    } catch (error) {
      console.error('Failed to sync offline actions:', error);
    }
  }
}