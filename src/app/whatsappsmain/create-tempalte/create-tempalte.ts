import { Component, signal, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

// ── Types ─────────────────────────────────────────────────
type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'NONE';
type ButtonType   = 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
type Category     = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

interface TemplateButton {
  type:        ButtonType;
  text:        string;
  url?:        string;
  urlExample?: string;
  phoneNumber?: string;
}

@Component({
  selector: 'app-create-tempalte',
  standalone:true,
  imports: [CommonModule,FormsModule],
  templateUrl: './create-tempalte.html',
  styleUrl: './create-tempalte.css',
})
export class CreateTempalte implements OnInit {

  private http = inject(HttpClient);

  // ── Inputs from parent ────────────────────────────────────
  @Input() wabaId    = '';
  @Input() isOpen    = false;
  @Output() closed   = new EventEmitter<void>();
  @Output() created  = new EventEmitter<void>();

  // ── Form fields ───────────────────────────────────────────
  templateName = '';
  language     = 'en_US';
  category: Category = 'UTILITY';

  // Header
  headerFormat: HeaderFormat = 'NONE';
  headerText   = '';

  // Body
  bodyText     = '';
  bodyExamples: string[] = [];

  // Footer
  footerText   = '';

  // Buttons
  buttons: TemplateButton[] = [];

  // ── UI state ──────────────────────────────────────────────
  loading = signal(false);
  success = signal('');
  error   = signal('');

  // ── Options ───────────────────────────────────────────────
  readonly languages = [
    { code: 'en_US', label: 'English (US)' },
    { code: 'en_GB', label: 'English (UK)' },
    { code: 'hi',    label: 'Hindi' },
    { code: 'ar',    label: 'Arabic' },
    { code: 'es',    label: 'Spanish' },
    { code: 'fr',    label: 'French' },
    { code: 'de',    label: 'German' },
    { code: 'pt_BR', label: 'Portuguese (BR)' },
    { code: 'id',    label: 'Indonesian' },
  ];

  readonly categories: { value: Category; label: string }[] = [
    { value: 'UTILITY',        label: '🔧 Utility' },
    { value: 'MARKETING',      label: '📣 Marketing' },
    { value: 'AUTHENTICATION', label: '🔐 Authentication' },
  ];

  readonly headerFormats: { value: HeaderFormat; label: string }[] = [
    { value: 'NONE',     label: 'None' },
    { value: 'TEXT',     label: 'Text' },
    { value: 'IMAGE',    label: 'Image' },
    { value: 'VIDEO',    label: 'Video' },
    { value: 'DOCUMENT', label: 'Document' },
  ];

  ngOnInit() { this.reset(); }

  // ── Body variable detection ───────────────────────────────
  get bodyVarCount(): number {
    const matches = this.bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const indices = matches.map(m => parseInt(m.replace(/\{\{|\}\}/g, '')));
    return indices.length ? Math.max(...indices) : 0;
  }

  onBodyTextChange() {
    const count = this.bodyVarCount;
    // Resize examples array
    while (this.bodyExamples.length < count)  this.bodyExamples.push('');
    while (this.bodyExamples.length > count)  this.bodyExamples.pop();
  }

  // ── Button helpers ────────────────────────────────────────
  addButton() {
    if (this.buttons.length >= 3) return;
    this.buttons.push({ type: 'QUICK_REPLY', text: '' });
  }

  removeButton(i: number) { this.buttons.splice(i, 1); }

  // ── Validation ────────────────────────────────────────────
  get isValid(): boolean {
    if (!this.templateName.trim()) return false;
    if (!this.bodyText.trim())     return false;
    // Body examples must all be filled
    if (this.bodyExamples.some(e => !e.trim())) return false;
    // Header text required if TEXT
    if (this.headerFormat === 'TEXT' && !this.headerText.trim()) return false;
    // Button validation
    for (const btn of this.buttons) {
      if (!btn.text.trim()) return false;
      if (btn.type === 'URL' && !btn.url?.trim()) return false;
      if (btn.type === 'PHONE_NUMBER' && !btn.phoneNumber?.trim()) return false;
    }
    return true;
  }

  // ── Submit ────────────────────────────────────────────────
  submit() {
    if (!this.isValid) { this.error.set('Sabhi required fields bharo.'); return; }

    this.loading.set(true);
    this.success.set('');
    this.error.set('');

    // Build payload
    const payload: any = {
      wabaId:       this.wabaId,
      templateName: this.templateName.trim().toLowerCase().replace(/\s+/g, '_'),
      language:     this.language,
      category:     this.category,
      body: {
        text:     this.bodyText,
        examples: this.bodyExamples,
      },
    };

    // Header
    if (this.headerFormat !== 'NONE') {
      payload.header = { format: this.headerFormat };
      if (this.headerFormat === 'TEXT') payload.header.text = this.headerText;
    }

    // Footer
    if (this.footerText.trim()) payload.footer = { text: this.footerText.trim() };

    // Buttons
    if (this.buttons.length > 0) payload.buttons = this.buttons;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.getToken()}`,
      'Content-Type':  'application/json',
    });

    this.http.post('/whatsapp/template_create', payload, { headers, responseType: 'text' })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('✅ Template created successfully!');
          setTimeout(() => { this.created.emit(); this.close(); }, 1800);
        },
        error: (err) => {
          this.loading.set(false);
          const msg = typeof err?.error === 'string'
            ? err.error
            : err?.error?.message ?? err.message ?? 'Unknown error';
          this.error.set(`❌ ${msg}`);
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────
  private getToken(): string {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  reset() {
    this.templateName  = '';
    this.language      = 'en_US';
    this.category      = 'UTILITY';
    this.headerFormat  = 'NONE';
    this.headerText    = '';
    this.bodyText      = '';
    this.bodyExamples  = [];
    this.footerText    = '';
    this.buttons       = [];
    this.success.set('');
    this.error.set('');
  }

  close() { this.reset(); this.closed.emit(); }

  trackByIndex(i: number) { return i; }
}