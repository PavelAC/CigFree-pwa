import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { AuthFormComponent } from "../auth-form/auth-form.component";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AuthFormComponent,RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onLogin(credentials: { email: string; password: string }) {
    this.isLoading = true;
    try {
      await this.authService.login(credentials.email, credentials.password);
      this.router.navigate(['/tracker']);
    } catch (error: any) {
      let errorMessage = 'Login failed. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Account temporarily disabled due to too many failed attempts';
          break;
      }
      
      console.error(errorMessage);
    } finally {
      this.isLoading = false;
    }
  }
}
