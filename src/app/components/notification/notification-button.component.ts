import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button 
      (click)="toggleNotifications()" 
      class="notification-button"
      [class.subscribed]="isSubscribed"
      [disabled]="isLoading">
      {{ buttonText }}
    </button>
    <div *ngIf="errorMessage" class="error-message">{{ errorMessage }}</div>
  `,
  styles: [`
    .notification-button {
      padding: 10px 15px;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      border: none;
      background-color: #e0e0e0;
      color: #333;
    }
    
    .notification-button.subscribed {
      background-color: #4CAF50;
      color: white;
    }
    
    .notification-button:hover {
      opacity: 0.9;
    }

    .notification-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .error-message {
      color: #f44336;
      font-size: 0.85rem;
      margin-top: 5px;
    }
  `]
})
export class NotificationButtonComponent implements OnInit, OnDestroy {
  isSubscribed = false;
  isLoading = false;
  errorMessage = '';
  private subscription: Subscription | null = null;
  
  constructor(private notificationService: NotificationService) {}
  
  get buttonText(): string {
    if (this.isLoading) {
      return 'Processing...';
    }
    return this.isSubscribed ? 'Disable Notifications' : 'Enable Notifications';
  }
  
  ngOnInit(): void {
    this.checkNotificationStatus();
    this.subscription = this.notificationService.subscriptionStatus$
      .subscribe(status => {
        this.isSubscribed = status;
        this.isLoading = false;
      });
  }
  
  async checkNotificationStatus(): Promise<void> {
    try {
      const status = await this.notificationService.getNotificationStatus();
      this.isSubscribed = status;
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  }
  
  async toggleNotifications(): Promise<void> {
    this.errorMessage = '';
    this.isLoading = true;
    
    try {
      await this.notificationService.togglePushNotifications();
    } catch (error) {
      console.error('Error toggling notifications:', error);
      this.errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to toggle notifications. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }
  
  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}