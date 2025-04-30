import { Component, inject } from '@angular/core';
import { TrackerService } from '../../services/tracker.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.scss'
})
export class TrackerComponent {
  daysSmokeFree$: Observable<number>;

  constructor(
    private trackerService: TrackerService,
    public authService: AuthService
  ) {
    this.daysSmokeFree$ = this.trackerService.smokeFreeDays$;
  }

  resetCounter() {
    this.trackerService.resetCounter();
  }
}
