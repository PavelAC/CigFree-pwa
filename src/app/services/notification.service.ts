import { Injectable, NgZone, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../app.config';
import { Firestore, collection, addDoc, deleteDoc, doc, query, where, getDocs } from '@angular/fire/firestore';
import { Auth, user } from '@angular/fire/auth';

export interface PushSubscriptionWithUser extends PushSubscriptionJSON {
  userId?: string;
  createdAt?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private onlineStatus = new BehaviorSubject<boolean>(navigator.onLine);
  public onlineStatus$ = this.onlineStatus.asObservable();
  
  private subscriptionStatus = new BehaviorSubject<boolean>(false);
  public subscriptionStatus$ = this.subscriptionStatus.asObservable();
  
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private user$ = user(this.auth);
  
  constructor(
    private swPush: SwPush,
    private ngZone: NgZone,
    private http: HttpClient
  ) {
    this.setupConnectivityListeners();
    this.setupPushListeners();
    this.checkSubscriptionStatus();
  }

  // Setup online/offline event listeners
  private setupConnectivityListeners() {
    window.addEventListener('online', () => this.updateOnlineStatus());
    window.addEventListener('offline', () => this.updateOnlineStatus());
  }

  // Setup push message and error listeners
  private setupPushListeners() {
    if (this.swPush.isEnabled) {
      // Handle push messages (useful for debugging)
      this.swPush.messages.subscribe(message => {
        console.log('Received push message:', message);
      });

      // Handle push errors
      this.swPush.notificationClicks.subscribe(event => {
        console.log('Notification clicked:', event);
        // You can add navigation or other logic here
      });

      // Handle subscription changes
      this.swPush.subscription.subscribe(sub => {
        this.subscriptionStatus.next(!!sub);
      });
    }
  }

  // Check current subscription status
  private async checkSubscriptionStatus() {
    if (!('serviceWorker' in navigator)) {
      this.subscriptionStatus.next(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      this.subscriptionStatus.next(!!subscription);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      this.subscriptionStatus.next(false);
    }
  }

  // Get notification status (for component use)
  public async getNotificationStatus(): Promise<boolean> {
    await this.checkSubscriptionStatus();
    return this.subscriptionStatus.value;
  }

  // Update connectivity status
  private updateOnlineStatus() {
    this.ngZone.run(() => {
      this.onlineStatus.next(navigator.onLine);
      this.showConnectivityNotification();
    });
  }

  // Show appropriate connectivity notification
  private async showConnectivityNotification() {
    const title = navigator.onLine ? 'Back Online' : 'Offline Mode';
    const body = navigator.onLine 
      ? 'You are now connected to the internet' 
      : 'You are currently offline. Some features may be limited.';

    await this.showNotification(title, { body });
  }

  // General notification method
  public async showNotification(title: string, options?: NotificationOptions): Promise<boolean> {
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return false;
      }
      
      // Try service worker first
      if ('serviceWorker' in navigator && this.swPush.isEnabled) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
        return true;
      }
      
      // Fallback to Web Notifications API
      if (Notification.permission === 'granted') {
        new Notification(title, options);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Notification failed:', error);
      return false;
    }
  }

  // Request notification permission
  public async requestPermission(): Promise<boolean> {
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        throw new Error('This browser does not support notifications');
      }

      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Permission request failed:', error);
      throw new Error('Failed to request notification permission');
    }
  }

  // Subscribe to push notifications using VAPID key from environment
  public async subscribeToPush(): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers are not supported in this browser');
    }
    
    if (!this.swPush.isEnabled) {
      throw new Error('Push notifications are not supported in this browser');
    }
    
    if (!environment.vapidPublicKey) {
      throw new Error('VAPID public key is not configured');
    }
    
    // First request permission if needed
    const permission = await this.requestPermission();
    if (!permission) {
      throw new Error('Notification permission denied');
    }
    
    try {
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: environment.vapidPublicKey
      });
      
      // Save subscription to Firestore
      await this.saveSubscriptionToFirestore(subscription);
      
      this.subscriptionStatus.next(true);
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      throw new Error('Failed to subscribe to push notifications');
    }
  }
  
  // Unsubscribe from push notifications
  public async unsubscribeFromPush(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !this.swPush.isEnabled) {
      throw new Error('Push notifications are not supported');
    }
    
    try {
      // Get current subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
        
      if (!subscription) {
        // Already unsubscribed
        this.subscriptionStatus.next(false);
        return true;
      }
      
      // Remove from Firestore first
      await this.removeSubscriptionFromFirestore(subscription);
      
      // Then unsubscribe
      const result = await subscription.unsubscribe();
      this.subscriptionStatus.next(false);
      return result;
    } catch (error) {
      console.error('Push unsubscription failed:', error);
      throw new Error('Failed to unsubscribe from push notifications');
    }
  }
  
  // Save subscription to Firestore
  private async saveSubscriptionToFirestore(subscription: PushSubscription): Promise<void> {
    try {
      const currentUser = await firstValueFrom(this.user$);
      const userId = currentUser?.uid;
      
      if (!userId) {
        console.warn('User not logged in, saving anonymous subscription');
      }
      
      const subscriptionData: PushSubscriptionWithUser = {
        ...subscription.toJSON(),
        userId: userId || 'anonymous',
        createdAt: Date.now()
      };
      
      // Check if subscription already exists
      const subscriptionsRef = collection(this.firestore, 'pushSubscriptions');
      const q = query(subscriptionsRef, where('endpoint', '==', subscriptionData.endpoint));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Add new subscription
        await addDoc(subscriptionsRef, subscriptionData);
        console.log('Subscription saved to Firestore');
      } else {
        console.log('Subscription already exists in Firestore');
      }
    } catch (error) {
      console.error('Error saving subscription to Firestore:', error);
      throw new Error('Failed to save notification subscription');
    }
  }
  
  // Remove subscription from Firestore
  private async removeSubscriptionFromFirestore(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionsRef = collection(this.firestore, 'pushSubscriptions');
      const q = query(subscriptionsRef, where('endpoint', '==', subscription.endpoint));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Delete subscription document
        const deletePromises = querySnapshot.docs.map(document => 
          deleteDoc(doc(this.firestore, 'pushSubscriptions', document.id))
        );
        
        await Promise.all(deletePromises);
        console.log('Subscription removed from Firestore');
      }
    } catch (error) {
      console.error('Error removing subscription from Firestore:', error);
      throw new Error('Failed to remove notification subscription');
    }
  }
  
  // Toggle push notification subscription
  public async togglePushNotifications(): Promise<boolean> {
    const isCurrentlySubscribed = this.subscriptionStatus.value;
    
    try {
      if (isCurrentlySubscribed) {
        return await this.unsubscribeFromPush();
      } else {
        return !!(await this.subscribeToPush());
      }
    } catch (error) {
      console.error('Failed to toggle push notifications:', error);
      throw error;
    }
  }
}