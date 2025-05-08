self.addEventListener('push', event => {
    const data = event.data?.json();
    const title = data?.title || 'CigFree';
    const options = {
      body: data?.body || 'You have new updates available',
      icon: '/icons/icon-192x192.png',
      data: {
        url: data?.url || '/'
      }
    };
  
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  });
  
  self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientsArr => {
        const hadWindowToFocus = clientsArr.some(windowClient => 
          windowClient.url === event.notification.data.url 
            ? (windowClient.focus(), true) 
            : false
        );
        
        if (!hadWindowToFocus) {
          clients.openWindow(event.notification.data.url || '/')
            .then(windowClient => windowClient ? windowClient.focus() : null);
        }
      })
    );
  });
  
  self.addEventListener('install', event => {
    self.skipWaiting();
    console.log('Service Worker installed');
  });
  
  self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
    console.log('Service Worker activated');
  });