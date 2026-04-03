import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterModule, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule,RouterOutlet],   
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  template: `<router-outlet></router-outlet>`
})
export class AppComponent implements OnInit{
 constructor(private router: Router,
  private authservice :AuthService
 ) {}

 ngOnInit() {
  const token = localStorage.getItem('token');
  const currentUrl = window.location.pathname; // ✅ IMPORTANT CHANGE

  if (
    (!token || !this.authservice.isTokenValid(token)) &&
    currentUrl !== '/register' &&
    currentUrl !== '/login'
  ) {
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}
}