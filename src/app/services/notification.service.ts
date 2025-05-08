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

  private setupConnectivityListeners() {
    window.addEventListener('online', () => this.updateOnlineStatus());
    window.addEventListener('offline', () => this.updateOnlineStatus());
  }

  private setupPushListeners() {
    if (this.swPush.isEnabled) {
      this.swPush.messages.subscribe(message => {
        console.log('Received push message:', message);
      });

      this.swPush.notificationClicks.subscribe(event => {
        console.log('Notification clicked:', event);
      });

      this.swPush.subscription.subscribe(sub => {
        this.subscriptionStatus.next(!!sub);
      });
    }
  }

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

  public async getNotificationStatus(): Promise<boolean> {
    await this.checkSubscriptionStatus();
    return this.subscriptionStatus.value;
  }

  private updateOnlineStatus() {
    this.ngZone.run(() => {
      this.onlineStatus.next(navigator.onLine);
      this.showConnectivityNotification();
    });
  }

  private async showConnectivityNotification() {
    const title = navigator.onLine ? 'Back Online' : 'Offline Mode';
    const body = navigator.onLine 
      ? 'You are now connected to the internet' 
      : 'You are currently offline. Some features may be limited.';

    await this.showNotification(title, { body });
  }

  public async showNotification(title: string, options?: NotificationOptions): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return false;
      }
      
      if ('serviceWorker' in navigator && this.swPush.isEnabled) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
        return true;
      }
      
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

  public async requestPermission(): Promise<boolean> {
    try {
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
    
    const permission = await this.requestPermission();
    if (!permission) {
      throw new Error('Notification permission denied');
    }
    
    try {
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: environment.vapidPublicKey
      });
      
      await this.saveSubscriptionToFirestore(subscription);
      
      this.subscriptionStatus.next(true);
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      throw new Error('Failed to subscribe to push notifications');
    }
  }
  
  public async unsubscribeFromPush(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !this.swPush.isEnabled) {
      throw new Error('Push notifications are not supported');
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
        
      if (!subscription) {
        this.subscriptionStatus.next(false);
        return true;
      }
      

      await this.removeSubscriptionFromFirestore(subscription);
      
      const result = await subscription.unsubscribe();
      this.subscriptionStatus.next(false);
      return result;
    } catch (error) {
      console.error('Push unsubscription failed:', error);
      throw new Error('Failed to unsubscribe from push notifications');
    }
  }
  
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
      
      const subscriptionsRef = collection(this.firestore, 'pushSubscriptions');
      const q = query(subscriptionsRef, where('endpoint', '==', subscriptionData.endpoint));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
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
  
  private async removeSubscriptionFromFirestore(subscription: PushSubscription): Promise<void> {
    try {
      const currentUser = await firstValueFrom(this.user$);
      const userId = currentUser?.uid || 'anonymous';
      
      // Query for subscriptions with this endpoint
      const q = query(
        collection(this.firestore, 'pushSubscriptions'),
        where('endpoint', '==', subscription.endpoint)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('No subscriptions found to delete');
        return;
      }
      
      console.log(`Found ${querySnapshot.size} subscriptions to delete`);
      
      // Delete each matching document
      const deletePromises = querySnapshot.docs.map(async (document) => {
        // Safety check: only delete documents owned by this user or anonymous
        const data = document.data();
        if (data['userId'] === userId || data['userId'] === 'anonymous') {
          console.log(`Deleting subscription: ${document.id}`);
          return deleteDoc(doc(this.firestore, 'pushSubscriptions', document.id));
        } else {
          console.log(`Skipping subscription ${document.id}: not owned by current user`);
          return Promise.resolve();
        }
      });
      
      await Promise.all(deletePromises);
      
      console.log('Subscriptions deleted successfully');
    } catch (error) {
      console.error('Error removing subscription from Firestore:', error);
      throw error;
    }
  }
  
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
  // In your removeSubscriptionFromFirestore method:

}