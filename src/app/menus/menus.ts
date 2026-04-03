import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { Whatsapp } from '../whatsapp/whatsapp';
import { DashboardComponent } from '../dashboard/dashboard.component';

@Component({
  selector: 'app-menus',
  imports: [CommonModule, RouterOutlet,RouterModule],
  standalone: true,
  templateUrl: './menus.html',
  styleUrl: './menus.css',
})
export class Menus implements OnInit {

  showChannelMenu = false;
  showDashboardMenu = false;
  showCRMMenu = false;
  activeView: string = '';
  isSidebarCollapsed = false;
  userEmail = '';
  isActive = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadUserFromToken();
  }

  private loadUserFromToken(): void {
    const token =
      localStorage.getItem('authToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('authToken') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('access_token');

    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.userEmail = payload.email || '';
      this.isActive = payload.isActive === 'True' || payload.isActive === true;
    } catch (e) {
      console.error('Token decode failed', e);
    }
  }

  getInitials(email: string): string {
    if (!email) return '?';
    const name = email.split('@')[0];
    const parts = name.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  toggleChannel(): void {
    this.showChannelMenu = !this.showChannelMenu;
    this.showDashboardMenu = false;
  }

  toggleDashboard(): void {
    this.showDashboardMenu = !this.showDashboardMenu;
    this.showChannelMenu = false;
  }
  toggleCRM(): void{
    this.showCRMMenu =!this.showCRMMenu;
    this.showChannelMenu = false;
    this.showDashboardMenu = false;
  }

  showView(view: string): void {
    this.activeView = view;
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('access_token');
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }
}