import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TrackerComponent } from "./pages/tracker/tracker.component";
import { InstallPromptComponent } from './components/install-prompt/install-prompt.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TrackerComponent, InstallPromptComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'cigfree';
}
