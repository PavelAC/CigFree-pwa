import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { isDevMode } from '@angular/core';

console.log('Bootstrap starting...');
console.log('isDevMode:', isDevMode());

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    console.log('App bootstrapped, checking SW...');
    
    if ('serviceWorker' in navigator && !isDevMode()) {
      console.log('Attempting SW registration...');
      
      navigator.serviceWorker.register('./ngsw-worker.js')
        .then(reg => {
          console.debug('Service Worker registered:', reg);
          // Optional: Periodically check for updates
          setInterval(() => reg.update(), 60 * 60 * 1000);
        })
        .catch(err => console.warn('Registration failed:', err));
    }
  })
  .catch(err => console.error('Bootstrap failed:', err));
