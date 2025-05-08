import { Component } from '@angular/core';
import { OfflineService } from '../../services/offline.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-offline-fallback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-fallback.component.html',
  styleUrl: './offline-fallback.component.scss'
})
export class OfflineFallbackComponent {
  checking = false;

  constructor(private offlineService: OfflineService) {}

  async checkConnection(): Promise<void> {
    this.checking = true;
    
    try {
      // Try to fetch a resource to check connectivity
      await fetch('/assets/connectivity-test.json', { 
        method: 'HEAD',
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      // If successful, reload the page
      window.location.reload();
    } catch (error) {
      // Still offline, do nothing
      setTimeout(() => {
        this.checking = false;
      }, 1000);
    }
  }
}
