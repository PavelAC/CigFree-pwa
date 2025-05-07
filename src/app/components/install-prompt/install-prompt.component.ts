import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-install-prompt',
  template: `
    <div class="install-prompt" *ngIf="showPrompt && canInstall">
      <div class="prompt-content">
        <p>Install this app for better experience</p>
        <div class="prompt-actions">
          <button class="install-btn" (click)="install()">Install</button>
          <button class="dismiss-btn" (click)="dismiss()">Later</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./install-prompt.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class InstallPromptComponent implements OnInit, OnDestroy {
  private deferredPrompt: any;
  showPrompt = false;
  canInstall = false;
  private isStandalone = false;

  ngOnInit() {
    this.checkInstallStatus();
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (!dismissed) {
      this.listenForInstallPrompt();
    }
  }

  ngOnDestroy() {
    window.removeEventListener('beforeinstallprompt', this.handleInstallPrompt);
  }

  private checkInstallStatus() {
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  }

  private listenForInstallPrompt() {
    window.addEventListener('beforeinstallprompt', this.handleInstallPrompt);
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  private handleInstallPrompt(e: Event) {
    e.preventDefault();
    this.deferredPrompt = e;
    this.canInstall = true;
    
    if (!this.isStandalone && this.meetsInstallCriteria()) {
      this.showPrompt = true;
    }
  }

  private meetsInstallCriteria(): boolean {
    return true;
  }

  async install() {
    if (!this.deferredPrompt) return;
    
    this.deferredPrompt.prompt();
    const choiceResult = await this.deferredPrompt.userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted install');
    } else {
      console.log('User dismissed install');
    }
    
    this.resetPrompt();
  }

  dismiss() {
    localStorage.setItem('installPromptDismissed', 'true');
    this.resetPrompt();
    // Show again after 7 days
    setTimeout(() => {
      localStorage.removeItem('installPromptDismissed');
    }, 7 * 24 * 60 * 60 * 1000);
  }

  private resetPrompt() {
    this.showPrompt = false;
    this.deferredPrompt = null;
    this.canInstall = false;
  }
}