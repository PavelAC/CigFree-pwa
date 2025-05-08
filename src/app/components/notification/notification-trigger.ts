import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification-trigger',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="notification-trigger">
      <h3>Send Test Notification</h3>
      
      <div class="form-group">
        <label for="notificationTitle">Title:</label>
        <input 
          type="text" 
          id="notificationTitle" 
          [(ngModel)]="notificationTitle" 
          placeholder="Notification Title"
        >
      </div>
      
      <div class="form-group">
        <label for="notificationBody">Message:</label>
        <textarea 
          id="notificationBody" 
          [(ngModel)]="notificationBody" 
          placeholder="Notification Message"
          rows="3"
        ></textarea>
      </div>
      
      <div class="form-group">
        <label for="notificationIcon">Icon URL (optional):</label>
        <input 
          type="text" 
          id="notificationIcon" 
          [(ngModel)]="notificationIcon" 
          placeholder="https://example.com/icon.png"
        >
      </div>
      
      <div class="actions">
        <button 
          (click)="sendNotification()" 
          [disabled]="isLoading || !notificationTitle" 
          class="send-button"
        >
          {{ isLoading ? 'Sending...' : 'Send Notification' }}
        </button>
      </div>
      
      <div *ngIf="result" class="result" [class.success]="result.success">
        {{ result.message }}
      </div>
    </div>
  `,
  styles: [`
    .notification-trigger {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      padding: 15px;
      margin: 15px 0;
      max-width: 500px;
    }
    
    h3 {
      margin-top: 0;
      color: #333;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    
    .form-group {
      margin-bottom: 15px;
    }
    
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #555;
    }
    
    input, textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .send-button {
      padding: 10px 15px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    
    .send-button:hover:not(:disabled) {
      background-color: #45a049;
    }
    
    .send-button:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
      opacity: 0.7;
    }
    
    .result {
      margin-top: 15px;
      padding: 10px;
      border-radius: 4px;
      background-color: #f8d7da;
      color: #721c24;
      font-size: 14px;
    }
    
    .result.success {
      background-color: #d4edda;
      color: #155724;
    }
  `]
})
export class NotificationTriggerComponent {
  notificationTitle = '';
  notificationBody = '';
  notificationIcon = '';
  isLoading = false;
  result: { success: boolean, message: string } | null = null;
  
  constructor(private notificationService: NotificationService) {}
  
  async sendNotification(): Promise<void> {
    if (!this.notificationTitle) {
      this.result = {
        success: false,
        message: 'Please enter a notification title'
      };
      return;
    }
    
    this.isLoading = true;
    this.result = null;
    
    try {
      // Check if notifications are permitted
      if (!('Notification' in window)) {
        throw new Error('This browser does not support notifications');
      }
      
      if (Notification.permission !== 'granted') {
        const permitted = await this.notificationService.requestPermission();
        if (!permitted) {
          throw new Error('Notification permission denied');
        }
      }
      
      // Build notification options
      const options: NotificationOptions = {
        body: this.notificationBody || undefined,
      };
      
      if (this.notificationIcon) {
        options.icon = this.notificationIcon;
      }
      
      // Send notification
      const success = await this.notificationService.showNotification(
        this.notificationTitle,
        options
      );
      
      if (success) {
        this.result = {
          success: true,
          message: 'Notification sent successfully!'
        };
      } else {
        throw new Error('Failed to send notification');
      }
    } catch (error) {
      this.result = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      this.isLoading = false;
    }
  }
}