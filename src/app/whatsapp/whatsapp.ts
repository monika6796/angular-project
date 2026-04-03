import { CommonModule } from '@angular/common';
import { Component, OnInit,ChangeDetectorRef } from '@angular/core';
import { HttpClient,HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';



interface BusinessProfile {
  Whatsapp_Business_Account_Id: string;
  Whatsapp_Business_Account_Name: string;
  Phone_number_id: string;
}

interface QualityScore {
  score: 'GREEN' | 'YELLOW' | 'RED' | string;
}

interface PhoneNumber {
  Phone_number_id: string;
  Display_phone_number: string;
  Verified_name: string;
  Status: string;
  Quality_Score: QualityScore;
  Messaging_limit_tier: string;
  BusinessProfile: BusinessProfile[];
}

interface WhatsappBusinessAccount {
  Whatsapp_Business_Account_Id: string;
  Whatsapp_Business_Account_Name: string;
  Currency?: string;
  Status: string;
  OwnershipType: string;
  PhoneNumbers: PhoneNumber[];
}

interface BusinessData {
  BusinessName: string;
  BusinessId: string;
  Link: string;
  PaymentAccountId?: string;
  TwoFactorType?: string;
  VerificationStatus: string;
  ProfilePictureUrl?: string;
  Whatsapp_Business_Manager_Messaging_Limit?: string;
  WhatsappBusinessAccounts?: WhatsappBusinessAccount[];
}
export interface ChannelCard {
  accountName: string;
  displayPhone: string;
  numberStatus: string;
  messageLimit: string;
  qualityScore: string;
  twoFaEnabled: string;
  profilePicUrl?: string;
  verificationStatus: string;
  businessName: string;
  currency?: string;
  ownershipType?: string;
  accountId: string;
  phoneNumberId: string;
}


@Component({
  selector: 'app-whatsapp',
  imports: [CommonModule],
  templateUrl: './whatsapp.html',
  styleUrl: './whatsapp.css',
})
export class Whatsapp implements OnInit {

   showChannelMenu = false;
  isLoading = false;
  errorMessage = '';
  channelCards: ChannelCard[] = [];
  filteredCards: ChannelCard[] = [];
  searchQuery = '';
  viewMode: 'grid' | 'list' = 'grid';
  sortAsc = true;

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, 
    private cdr: ChangeDetectorRef,
  private router : Router) {}

  ngOnInit(): void {
    this.fetchChannelData();
  }

  toggleChannel() {
    this.showChannelMenu = !this.showChannelMenu;
  }

  fetchChannelData(): void {
    // ── 1. Token: check all common storage keys ──────────────────────────
    const token =
      localStorage.getItem('authToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('authToken') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('access_token');

    console.log('[Dashboard] Token found:', !!token);
    console.log('[Dashboard] API URL:', `${this.apiUrl}/get_whatsapp/data`);

    if (!token) {
      this.errorMessage = 'Token not found. Please login again.';
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.get<any>(`${this.apiUrl}/get_whatsapp/data`, { headers })
      .subscribe({
        next: (data) => {
          console.log('[Dashboard] Raw API response:', data);
          console.log('[Dashboard] Type:', typeof data, Array.isArray(data));

          // Handle: plain array OR { data: [] } OR { result: [] }
          let list: BusinessData[] = [];
          if (Array.isArray(data)) {
            list = data;
          } else if (data && Array.isArray(data.data)) {
            list = data.data;
          } else if (data && Array.isArray(data.result)) {
            list = data.result;
          } else if (data && typeof data === 'object') {
            // last resort: grab first array value found in the object
            const firstArr = Object.values(data).find(v => Array.isArray(v));
            list = (firstArr as BusinessData[]) ?? [];
          }

          console.log('[Dashboard] List to process:', list.length, 'items');

          this.channelCards = this.flattenToCards(list);
          this.filteredCards = [...this.channelCards];
          this.isLoading = false;

          console.log('[Dashboard] Cards built:', this.channelCards.length);

          // Force Angular change detection
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('[Dashboard] HTTP Error:', err.status, err.message, err);
          this.errorMessage = `Error ${err.status || ''}: ${err.error?.message || err.message || 'Failed to load channels.'}`;
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private flattenToCards(businesses: BusinessData[]): ChannelCard[] {
    const cards: ChannelCard[] = [];

    businesses.forEach(business => {
      if (business.WhatsappBusinessAccounts && business.WhatsappBusinessAccounts.length > 0) {
        business.WhatsappBusinessAccounts.forEach(account => {
          if (account.PhoneNumbers && account.PhoneNumbers.length > 0) {
            account.PhoneNumbers.forEach(phone => {
              cards.push({
                accountName: account.Whatsapp_Business_Account_Name || 'N/A',
                displayPhone: phone.Display_phone_number || 'N/A',
                numberStatus: phone.Status || 'NA',
                messageLimit: phone.Messaging_limit_tier || 'NA',
                qualityScore: phone.Quality_Score?.score || 'NA',
                twoFaEnabled: business.VerificationStatus === 'verified' ? 'Yes' : 'No',
                profilePicUrl: business.ProfilePictureUrl,
                verificationStatus: business.VerificationStatus || 'NA',
                businessName: business.BusinessName,
                currency: account.Currency,
                ownershipType: account.OwnershipType,
                accountId: account.Whatsapp_Business_Account_Id,
                phoneNumberId: phone.Phone_number_id
              });
            });
          } else {
            // Account with no phone numbers — show partial card
            cards.push({
              accountName: account.Whatsapp_Business_Account_Name || 'N/A',
              displayPhone: 'N/A',
              numberStatus: 'NA',
              messageLimit: 'NA',
              qualityScore: 'NA',
              twoFaEnabled: business.VerificationStatus === 'verified' ? 'Yes' : 'No',
              profilePicUrl: business.ProfilePictureUrl,
              verificationStatus: business.VerificationStatus || 'NA',
              businessName: business.BusinessName,
              currency: account.Currency,
              ownershipType: account.OwnershipType,
              accountId: account.Whatsapp_Business_Account_Id,
              phoneNumberId: ''
            });
          }
        });
      }
      // Businesses with no WhatsApp accounts are skipped
    });

    return cards;
  }

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchQuery = query;
    this.applyFilters();
  }

  sortAscending(): void {
    this.sortAsc = true;
    this.filteredCards.sort((a, b) => a.accountName.localeCompare(b.accountName));
  }

  sortDescending(): void {
    this.sortAsc = false;
    this.filteredCards.sort((a, b) => b.accountName.localeCompare(a.accountName));
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  private applyFilters(): void {
    this.filteredCards = this.channelCards.filter(card =>
      card.accountName.toLowerCase().includes(this.searchQuery) ||
      card.displayPhone.toLowerCase().includes(this.searchQuery) ||
      card.businessName.toLowerCase().includes(this.searchQuery)
    );
  }

  getQualityClass(score: string): string {
    switch (score?.toUpperCase()) {
      case 'GREEN': return 'quality-green';
      case 'YELLOW': return 'quality-yellow';
      case 'RED': return 'quality-red';
      default: return 'quality-na';
    }
  }

  getStatusClass(status: string): string {
    return status?.toUpperCase() === 'CONNECTED' ? 'status-connected' : 'status-disconnected';
  }

  openTemplates(card :ChannelCard){

    this.router.navigate(['/home/whatsapp-templates'],{
      queryParams:{
        Whatsapp_Business_Account_Id:card.accountId,
        Phone_number_id: card.phoneNumberId
      }
    })
  }
}
