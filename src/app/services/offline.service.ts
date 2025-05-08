import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { SwUpdate } from '@angular/service-worker';

@Injectable({
  providedIn: 'root'
})
export class OfflineService {
  private online$ = new BehaviorSubject<boolean>(navigator.onLine);
  private hasNetworkConnection$ = new BehaviorSubject<boolean>(true);
  private hasInternetAccess$ = new BehaviorSubject<boolean>(true);
  
  // Expose as observables
  readonly isOnline$ = this.online$.asObservable();
  readonly isOffline$ = this.online$.pipe(map(online => !online));
  
  // Event that other services can listen to for sync operations
  private syncRequired = new BehaviorSubject<boolean>(false);
  readonly syncRequired$ = this.syncRequired.asObservable();

  constructor(private swUpdate: SwUpdate) {
    this.initializeNetworkObservers();
    this.checkConnectivity();
  }

  private initializeNetworkObservers(): void {
    // When the browser reports being online or offline
    merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false))
    ).subscribe(online => {
      this.online$.next(online);
      if (online) {
        // When coming back online, emit sync event and check for updates
        this.syncRequired.next(true);
        this.swUpdate.checkForUpdate().catch(err => 
          console.error('Failed to check for updates:', err)
        );
      }
    });

    // Listen for service worker updates
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe(event => {
        if (event.type === 'VERSION_READY') {
          console.log('New app version ready for use');
          // You can prompt the user to refresh or auto-refresh
        }
      });
    }
  }

  private async checkConnectivity(): Promise<void> {
    // Periodically check connectivity to key resources
    setInterval(async () => {
      try {
        // Try to fetch a small resource to verify internet access
        const result = await fetch('/assets/connectivity-test.json', { 
          method: 'HEAD',
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        const isOnline = result.ok;
        this.hasInternetAccess$.next(isOnline);
        
        // If connectivity state changed to online, trigger sync
        if (isOnline && !this.online$.value) {
          this.online$.next(true);
          this.syncRequired.next(true);
        } else if (!isOnline && this.online$.value) {
          this.online$.next(false);
        }
      } catch (error) {
        this.hasInternetAccess$.next(false);
        if (this.online$.value) {
          this.online$.next(false);
        }
      }
    }, 30000);
  }

  // Methods to force cache refresh when back online
  async refreshCachedData(): Promise<void> {
    if (navigator.onLine && this.swUpdate.isEnabled) {
      try {
        await this.swUpdate.checkForUpdate();
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }
  }
  
  // Trigger a sync manually (can be called by components)
  triggerSync(): void {
    this.syncRequired.next(true);
  }
}