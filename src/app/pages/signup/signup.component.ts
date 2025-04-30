import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { AuthFormComponent } from "../auth-form/auth-form.component";

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [AuthFormComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSignUp(credentials: { email: string; password: string; displayName?: string }) {
    this.isLoading = true;
    try {
      await this.authService.signUp(
        credentials.email, 
        credentials.password,
        credentials.displayName
      );
      this.router.navigate(['/tracker']);
    } catch (error: any) {
      let errorMessage = 'Signup failed. Please try again.';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address';
          break;
      }
      
      console.error(errorMessage);
    } finally {
      this.isLoading = false;
    }
  }
}
