// import { Component } from '@angular/core';
// import { RouterOutlet } from '@angular/router';
// import { InstallPromptComponent } from './components/install-prompt/install-prompt.component';
// import { NotificationService } from './services/notification.service';
// import { CommonModule } from '@angular/common';
// import { NotificationButtonComponent } from "./components/notification-button.component.ts/notification-button.component";
// import { NotificationTriggerComponent } from "./components/notification-button.component.ts/notification-trigger";

// @Component({
//   selector: 'app-root',
//   standalone: true,
//   imports: [RouterOutlet, InstallPromptComponent, CommonModule, NotificationButtonComponent, NotificationTriggerComponent],
//   templateUrl: './app.component.html',
//   styleUrl: './app.component.scss'
// })
// export class AppComponent {
//   constructor(public notificationService: NotificationService) {}

//   async ngOnInit() {

//     const hasPermission = await this.notificationService.requestPermission();
    
//     this.notificationService.onlineStatus$.subscribe(isOnline => {
//       console.log('Connectivity changed:', isOnline);
//     });
    
//     this.notificationService.showNotification('Welcome!', {
//       body: 'Thanks for using our app',
//       icon: 'icons/icon-192x192.png'
//     });
//   }
// }

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { InstallPromptComponent } from './components/install-prompt/install-prompt.component';
import { NotificationService } from './services/notification.service';
import { NotificationButtonComponent } from "./components/notification/notification-button.component";
import { NotificationTriggerComponent } from "./components/notification/notification-trigger";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    InstallPromptComponent,
    NotificationButtonComponent,
    NotificationTriggerComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(public notificationService: NotificationService) {}

  async ngOnInit() {
    try {
      const hasPermission = await this.notificationService.requestPermission();
      
      if (hasPermission) {
        // Only show welcome notification if permission is granted
        this.notificationService.showNotification('Welcome!', {
          body: 'Thanks for using our app',
          icon: 'icons/icon-192x192.png'
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
    
    this.notificationService.onlineStatus$.subscribe(isOnline => {
      console.log('Connectivity changed:', isOnline);
    });
  }
}