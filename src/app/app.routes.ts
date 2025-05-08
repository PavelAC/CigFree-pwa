import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { TrackerComponent } from './pages/tracker/tracker.component';

export const routes: Routes = [
    { 
        path: '', 
        redirectTo: '/login', 
        pathMatch: 'full' 
      },
    { path: 'login', component: LoginComponent },
    { path: 'signup', component: SignupComponent },
    { path: 'tracker', component: TrackerComponent },
];
