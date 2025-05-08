import { Component, inject } from '@angular/core';
import { TrackerService } from '../../services/tracker.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, combineLatest, Observable, map } from 'rxjs';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.scss'
})
export class TrackerComponent {
  private trackerService = inject(TrackerService);
  protected authService = inject(AuthService);
  
  private additionalDays = new BehaviorSubject<number>(0);
  
  daysSmokeFree$: Observable<number> = combineLatest([
    this.trackerService.smokeFreeDays$,
    this.additionalDays
  ]).pipe(
    map(([baseDays, extraDays]) => baseDays + extraDays)
  );
  
  isAddingDay = false;
  isResetting = false;

  constructor() {}

  async resetCounter() {
    this.isResetting = true;
    
    try {
      this.additionalDays.next(0);
      
      await this.trackerService.resetCounter();
    } catch (error) {
      console.error('Error resetting counter:', error);
    } finally {
      this.isResetting = false;
    }
  }
  
  async addOneDay() {
    this.isAddingDay = true;
    
    try {
      this.additionalDays.next(this.additionalDays.value + 1);
      
      await this.trackerService.addOneDay();
    } catch (error) {
      console.error('Failed to add day:', error);
      this.additionalDays.next(Math.max(0, this.additionalDays.value - 1));
    } finally {
      this.isAddingDay = false;
    }
  }
}
