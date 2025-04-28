import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

import { routes } from './app.routes';

export const firebaseConfig = {
  apiKey: "AIzaSyC4d-LldAIB68LlV6eiPkn7mFQFpnsuuuY",
  authDomain: "cigfree-6acdb.firebaseapp.com",
  projectId: "cigfree-6acdb",
  storageBucket: "cigfree-6acdb.firebasestorage.app",
  messagingSenderId: "501554185927",
  appId: "1:501554185927:web:98609d6474b7a4cf7860e2",
  measurementId: "G-ZZ8XHHZDGL"
};


export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
   
        // Firebase providers
        provideFirebaseApp(() => initializeApp(firebaseConfig)),
        provideAuth(() => getAuth()),
        provideFirestore(() => getFirestore()),


  ]
};
