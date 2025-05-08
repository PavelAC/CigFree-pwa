import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { TrackerService } from '../../services/tracker.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, combineLatest, Observable, map, interval, Subscription } from 'rxjs';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.scss'
})
export class TrackerComponent implements OnInit, OnDestroy {
  private trackerService = inject(TrackerService);
  protected authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  
  private additionalDays = new BehaviorSubject<number>(0);
  private subscriptions: Subscription[] = [];
  
  daysSmokeFree$: Observable<number> = combineLatest([
    this.trackerService.smokeFreeDays$,
    this.additionalDays
  ]).pipe(
    map(([baseDays, extraDays]) => baseDays + extraDays)
  );
  
  isAddingDay = false;
  isResetting = false;
  isSyncing = false;
  hasPendingSync = false;

  constructor() {}

  ngOnInit() {
    this.checkPendingSync();
    
    const checkSub = interval(5000).subscribe(() => {
      this.checkPendingSync();
    });
    
    const onlineSub = this.notificationService.onlineStatus$.subscribe(isOnline => {
      if (isOnline && this.hasPendingSync) {
        this.syncOfflineData();
      }
    });
    
    this.subscriptions.push(checkSub, onlineSub);
  }
  
  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  private checkPendingSync() {

    const trackerActions = localStorage.getItem('tracker_offline_actions');
    this.hasPendingSync = !!(trackerActions && JSON.parse(trackerActions).length > 0);
  }

  async resetCounter() {
    this.isResetting = true;
    
    try {
      this.additionalDays.next(0);
      await this.trackerService.resetCounter();
    } catch (error) {
      console.error('Error resetting counter:', error);
    } finally {
      this.isResetting = false;
      this.checkPendingSync();
    }
  }
  
  async addOneDay() {
    this.isAddingDay = true;
    
    try {
      this.additionalDays.next(this.additionalDays.value + 1);
      
      await this.trackerService.addOneDay();
    } catch (error) {
      console.error('Failed to add day:', error);
      this.additionalDays.next(Math.max(0, this.additionalDays.value - 1));
    } finally {
      this.isAddingDay = false;
      this.checkPendingSync();
    }
  }
  
  async syncOfflineData() {
    if (!this.hasPendingSync || this.isSyncing) return;
    
    this.isSyncing = true;
    
    try {
      await this.trackerService.syncOfflineActions();
      this.additionalDays.next(0);
      this.hasPendingSync = false;
      
      this.notificationService.showNotification(
        'Synchronization Complete', 
        { 
          body: 'Your offline changes have been synchronized',
          icon: 'icons/icon-192x192.png'
        }
      );
    } catch (error) {
      console.error('Error during sync:', error);
      
      this.notificationService.showNotification(
        'Synchronization Failed', 
        { 
          body: 'Please try again later or check your connection',
          icon: 'icons/icon-192x192.png'
        }
      );
    } finally {
      this.isSyncing = false;
      this.checkPendingSync();
    }
  }
}