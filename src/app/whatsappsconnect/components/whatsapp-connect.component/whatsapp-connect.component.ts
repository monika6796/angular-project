import { Component, OnInit, NgZone } from '@angular/core';
import { WhatsAppService } from '../../services/whatsapp.service';
import { WhatsAppConnectResponse } from '../../models/whatsapp.models';
import { CommonModule } from '@angular/common';

declare const FB: any;
@Component({
  selector: 'app-whatsapp-connect.component',
  imports: [CommonModule],
  templateUrl: './whatsapp-connect.component.html',
  styleUrl: './whatsapp-connect.component.css',
})
export class WhatsAppConnectComponent implements OnInit {

  readonly APP_ID = '1080263086858310';          // aapka Meta App ID
  readonly CONFIG_ID = '1628839851480470';    // Embedded Signup config ID

  status: WhatsAppConnectResponse | null = null;
  loading = false;
  error = '';

  // wabaId store karo message event se
  private _wabaId = '';

  constructor(
    private waService: WhatsAppService,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadFbSdk();
    this.listenForWabaId();
    this.checkStatus();
  }

  // ── FB SDK load karo ──────────────────────────────────────

  private loadFbSdk(): void {
    // Agar already loaded hai to skip karo
    if (document.getElementById('facebook-jssdk')) return;

    (window as any).fbAsyncInit = () => {
      FB.init({
        appId: this.APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v23.0'
      });
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }

  // ── WabaId listener — popup se aata hai ──────────────────

  private listenForWabaId(): void {
    window.addEventListener('message', (event) => {
      if (event.origin !== 'https://www.facebook.com') return;

      try {
        const data = JSON.parse(event.data);

        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          this.zone.run(() => {
            if (data.event === 'FINISH') {
              // WABA ID aur Phone Number ID yahan milta hai
              this._wabaId = data.data.waba_id;
              console.log('WABA ID:', data.data.waba_id);
              console.log('Phone ID:', data.data.phone_number_id);
            } else if (data.event === 'CANCEL') {
              this.error = 'Setup cancelled by user.';
            } else if (data.event === 'ERROR') {
              this.error = 'Setup error: ' + data.data.error_message;
            }
          });
        }
      } catch (e) {
        // parse error — ignore karo
      }
    });
  }

  // ── Connect button click ──────────────────────────────────

  connectWhatsApp(): void {
    this.loading = true;
    this.error = '';

    FB.login((response: any) => {
      this.zone.run(() => {
        if (response.authResponse?.code) {
          // code mila — backend ko bhejo
          this.waService.connect({
            code: response.authResponse.code,
            wabaId: this._wabaId
          }).subscribe({
            next: (res) => {
              this.status = res;
              this.loading = false;
            },
            error: (err) => {
              this.error = 'Connection failed. Please try again.';
              this.loading = false;
              console.error(err);
            }
          });
        } else {
          // User ne cancel kiya
          this.loading = false;
          this.error = 'Login cancelled or permissions not granted.';
        }
      });
    }, {
      config_id: this.CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        feature: 'whatsapp_embedded_signup',
        sessionInfoVersion: 2
      }
    });
  }

  // ── Status check ─────────────────────────────────────────

  checkStatus(): void {
    this.waService.getStatus().subscribe({
      next: (res) => {
        this.status = res?.isConnected ? res : null;
      },
      error: () => {
        this.status = null;
      }
    });
  }

  // ── Disconnect ───────────────────────────────────────────

  disconnectWhatsApp(): void {
    this.loading = true;
    this.waService.disconnect().subscribe({
      next: () => {
        this.status = null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}