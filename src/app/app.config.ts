import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const firebaseConfig = {
  apiKey: "AIzaSyC4d-LldAIB68LlV6eiPkn7mFQFpnsuuuY",
  authDomain: "cigfree-6acdb.firebaseapp.com",
  projectId: "cigfree-6acdb",
  storageBucket: "cigfree-6acdb.firebasestorage.app",
  messagingSenderId: "501554185927",
  appId: "1:501554185927:web:98609d6474b7a4cf7860e2",
  measurementId: "G-ZZ8XHHZDGL"
};

export const environment = {
  production: false,
  vapidPublicKey: 'BMWSM3_SRYpByYU92CqyAh0ldQ5QsfQMf_-i6BU-tGF4dn3EWHCrZXuQvr9CXyfVBp8Lmi5pSBx13iINRPFQ6zU'
}


export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
   
    provideHttpClient(withFetch()),
    // Firebase providers
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()), 
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ]
};
