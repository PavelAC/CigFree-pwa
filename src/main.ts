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
      
      // First register Angular's service worker
      navigator.serviceWorker.register('./ngsw-worker.js')
        .then(angularReg => {
          console.debug('Angular Service Worker registered:', angularReg);
          
          // Then register custom service worker
          return navigator.serviceWorker.register('/custom-sw.js', {
            scope: '/',
            type: 'classic'
          }).then(customReg => {
            console.debug('Custom Service Worker registered:', customReg);
            
            // Set up periodic updates (every hour)
            setInterval(() => {
              angularReg.update();
              customReg.update();
            }, 60 * 60 * 1000);

            return { angularReg, customReg };
          });
        })
        .then(({ angularReg, customReg }) => {
          navigator.serviceWorker.addEventListener('error', (event) => {
            console.error('Service Worker error occurred');
          });
          
          navigator.serviceWorker.addEventListener('message', event => {
            console.log('Received message from SW:', event.data);
          });
        })
        .catch(err => console.warn('Service Worker registration failed:', err));
    }
  })
  .catch(err => console.error('Application bootstrap failed:', err));