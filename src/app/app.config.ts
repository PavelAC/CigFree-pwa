import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore, enableMultiTabIndexedDbPersistence, enableIndexedDbPersistence, initializeFirestore, persistentLocalCache, persistentSingleTabManager, persistentMultipleTabManager } from '@angular/fire/firestore';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';

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
   
    provideHttpClient(
      withFetch(),
      withInterceptorsFromDi()
    ),
    // Firebase providers
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => {
      try {
        const firestore = initializeFirestore(initializeApp(firebaseConfig), {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        });
        
        console.log('Firestore initialized with multi-tab persistence');
        return firestore;
      } catch (multiTabError) {
        console.warn('Multi-tab persistence failed:', multiTabError);
        
        try {
          const firestore = initializeFirestore(initializeApp(firebaseConfig), {
            localCache: persistentLocalCache({
              tabManager: persistentSingleTabManager({})
            })
          });
          
          console.log('Firestore initialized with single-tab persistence');
          return firestore;
        } catch (singleTabError) {
          console.error('Could not initialize Firestore with persistence:', singleTabError);
          
          const firestore = getFirestore();
          console.warn('Using Firestore without explicit persistence configuration');
          return firestore;
        }
      }
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: true,
      registrationStrategy: 'registerImmediately'
    }),
  ]
};
