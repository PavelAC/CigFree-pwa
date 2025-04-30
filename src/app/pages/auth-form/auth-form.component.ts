import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';

interface AuthFormData {
  email: string;
  password: string;
  displayName?: string;
}

@Component({
  selector: 'app-auth-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './auth-form.component.html',
  styleUrl: './auth-form.component.scss'
})
export class AuthFormComponent {
  @Input() isSignUp = false;
  @Input() isLoading = false;
  @Output() submitForm = new EventEmitter<AuthFormData>();

  authForm = new FormGroup({
    email: new FormControl<string>('', [Validators.required, Validators.email]),
    password: new FormControl<string>('', [
      Validators.required,
      Validators.minLength(6)
    ]),
    displayName: new FormControl<string>('')
  });

  errorMessage = '';
  get email(): AbstractControl<string | null> {
    return this.authForm.get('email')!;
  }
  
  get password(): AbstractControl<string | null> {
    return this.authForm.get('password')!;
  }
  
  get displayName(): AbstractControl<string | null> {
    return this.authForm.get('displayName')!;
  }

  onSubmit(): void {
    if (this.authForm.invalid) return;
    
    const formData: AuthFormData = {
      email: this.getControlValue(this.email),
      password: this.getControlValue(this.password),
      ...(this.displayName.value && { displayName: this.getControlValue(this.displayName) })
    };

    this.submitForm.emit(formData);
  }

  setError(message: string): void {
    this.errorMessage = message;
  }

  private getControlValue(control: AbstractControl): string {
    return control.value ?? '';
  }
}