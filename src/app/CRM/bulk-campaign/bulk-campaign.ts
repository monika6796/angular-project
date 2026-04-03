import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Contact {
  id: number;
  contactWaId: string;
  contactName: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  isActive: boolean;
  selected: boolean;
}

export interface ConversationsResponse {
  items: Contact[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface TemplateButton {
  type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  example?: {
    body_text?: string[][];
    header_handle?: string[];
    header_text?: string[];
  };
  buttons?: TemplateButton[];
}

export interface WhatsappTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: TemplateComponent[];
}

export interface VarMapping {
  index: number;
  label: string;
  mapTo: 'contactName' | 'contactWaId' | 'custom';
  customValue: string;
}

export interface CampaignResult {
  contactName: string;
  phone: string;
  status: 'pending' | 'sending' | 'success' | 'failed';
  error?: string;
}

export type CampaignStep = 1 | 2 | 3 | 4 | 5;

@Component({
  selector: 'app-bulk-campaign',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-campaign.html',
  styleUrl: './bulk-campaign.css',
})
export class BulkCampaign implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  // ── Route params ──────────────────────────────────────────────────────────
  wabaId      = signal('');
  phone_Id    = signal('');

  // ── Steps ─────────────────────────────────────────────────────────────────
  currentStep = signal<CampaignStep>(1);

  // ── Step 1: Contacts ──────────────────────────────────────────────────────
  contacts        = signal<Contact[]>([]);
  contactsLoading = signal(false);
  contactsError   = signal('');
  contactSearch   = signal('');
  totalCount      = signal(0);
  currentPage     = signal(1);
  hasMore         = signal(false);
  selectAll       = signal(false);

  // CSV
  csvContacts   = signal<Contact[]>([]);
  csvError      = signal('');
  activeTab     = signal<'db' | 'csv'>('db');

  filteredContacts = computed(() => {
    const q = this.contactSearch().toLowerCase();
    return this.contacts().filter(c =>
      c.contactName.toLowerCase().includes(q) ||
      c.contactWaId.includes(q)
    );
  });

  selectedContacts = computed(() =>
    [...this.contacts(), ...this.csvContacts()].filter(c => c.selected)
  );

  // ── Step 2: Template ──────────────────────────────────────────────────────
  templates        = signal<WhatsappTemplate[]>([]);
  templatesLoading = signal(false);
  selectedTemplate = signal<WhatsappTemplate | null>(null);
  templateSearch   = signal('');

  filteredTemplates = computed(() => {
    const q = this.templateSearch().toLowerCase();
    return this.templates().filter(t =>
      t.name.toLowerCase().includes(q) && t.status === 'APPROVED'
    );
  });

  // ── Step 3: Variable Mapping ──────────────────────────────────────────────
  bodyVarMappings:   VarMapping[] = [];
  headerVarMappings: VarMapping[] = [];
  buttonVarMappings: VarMapping[] = [];

  // ── Step 4: Schedule ──────────────────────────────────────────────────────
  scheduleType    = signal<'now' | 'later'>('now');
  scheduleDate    = signal('');
  scheduleTime    = signal('');
  campaignName    = signal('');
  scheduleError   = signal('');

  // ── Step 5: Progress ──────────────────────────────────────────────────────
  campaignResults  = signal<CampaignResult[]>([]);
  campaignRunning  = signal(false);
  campaignDone     = signal(false);
  scheduledTimer:  any = null;

  sentCount    = computed(() => this.campaignResults().filter(r => r.status === 'success').length);
  failedCount  = computed(() => this.campaignResults().filter(r => r.status === 'failed').length);
  pendingCount = computed(() => this.campaignResults().filter(r => r.status === 'pending' || r.status === 'sending').length);
  progressPct  = computed(() => {
    const total = this.campaignResults().length;
    if (!total) return 0;
    return Math.round(((this.sentCount() + this.failedCount()) / total) * 100);
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.wabaId.set(params['Whatsapp_Business_Account_Id'] || '110787338696955');
      this.phone_Id.set(params['Phone_number_id'] || '106035212510059');
      if (this.wabaId()) {
        this.fetchContacts();
        this.fetchTemplates();
      }
    });

    // Set default schedule time to now + 10 min
    const d = new Date(Date.now() + 10 * 60000);
    this.scheduleDate.set(d.toISOString().split('T')[0]);
    this.scheduleTime.set(d.toTimeString().slice(0, 5));
  }

  private getToken(): string {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
  }

  // ── Step 1: Fetch Contacts ────────────────────────────────────────────────
  fetchContacts(page = 1) {
    this.contactsLoading.set(true);
    this.contactsError.set('');
    const url = `/whatsapp/chat/conversations?wabaId=${this.wabaId()}&phoneNumberId=${this.phone_Id()}&page=${page}&pageSize=50`;

    this.http.get<ConversationsResponse>(url, { headers: this.headers }).subscribe({
      next: res => {
        const mapped = res.items.map(c => ({ ...c, selected: false }));
        if (page === 1) this.contacts.set(mapped);
        else this.contacts.update(prev => [...prev, ...mapped]);
        this.totalCount.set(res.totalCount);
        this.hasMore.set(res.hasMore);
        this.currentPage.set(page);
        this.contactsLoading.set(false);
      },
      error: err => {
        this.contactsError.set(`❌ Contacts load failed: ${err.message}`);
        this.contactsLoading.set(false);
      }
    });
  }

  loadMoreContacts() {
    if (this.hasMore()) this.fetchContacts(this.currentPage() + 1);
  }

  toggleSelectAll(checked: boolean) {
    this.selectAll.set(checked);
    if (this.activeTab() === 'db') {
      this.contacts.update(cs => cs.map(c => ({ ...c, selected: checked })));
    } else {
      this.csvContacts.update(cs => cs.map(c => ({ ...c, selected: checked })));
    }
  }

  toggleContact(id: number, checked: boolean) {
    this.contacts.update(cs =>
      cs.map(c => c.id === id ? { ...c, selected: checked } : c)
    );
  }

  toggleCsvContact(waId: string, checked: boolean) {
    this.csvContacts.update(cs =>
      cs.map(c => c.contactWaId === waId ? { ...c, selected: checked } : c)
    );
  }

  // ── CSV Upload ────────────────────────────────────────────────────────────
  onCsvUpload(event: Event) {
    this.csvError.set('');
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { this.csvError.set('CSV empty hai.'); return; }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx  = headers.findIndex(h => h.includes('name'));
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('wa'));

      if (phoneIdx === -1) { this.csvError.set('CSV mein phone/mobile column nahi mila.'); return; }

      const parsed: Contact[] = lines.slice(1).map((line, i) => {
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
        return {
          id: -(i + 1),
          contactWaId: cols[phoneIdx] || '',
          contactName: nameIdx >= 0 ? cols[nameIdx] : cols[phoneIdx],
          lastMessagePreview: 'CSV Import',
          lastMessageAt: new Date().toISOString(),
          unreadCount: 0,
          isActive: true,
          selected: true
        };
      }).filter(c => c.contactWaId);

      this.csvContacts.set(parsed);
    };
    reader.readAsText(file);
  }

  downloadSampleCsv() {
    const csv = 'name,phone\nJohn Doe,919876543210\nJane Smith,918765432109';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sample_contacts.csv';
    a.click();
  }

  // ── Step 2: Templates ─────────────────────────────────────────────────────
  fetchTemplates() {
    this.templatesLoading.set(true);
    this.http.get<any>(`/whatsapp/${this.wabaId()}?limit=100`, { headers: this.headers }).subscribe({
      next: res => {
        const data = Array.isArray(res) ? res[0]?.data : res?.data;
        this.templates.set(data || []);
        this.templatesLoading.set(false);
      },
      error: () => this.templatesLoading.set(false)
    });
  }

  selectTemplate(t: WhatsappTemplate) {
    this.selectedTemplate.set(t);
  }

  // ── Step 3: Variable Mapping ──────────────────────────────────────────────
  buildVarMappings() {
    const tpl = this.selectedTemplate();
    if (!tpl) return;

    const extractVars = (text: string, label: string): VarMapping[] => {
      const matches = [...new Set((text.match(/\{\{(\d+)\}\}/g) || []))];
      return matches.map(m => {
        const idx = parseInt(m.replace(/\{\{|\}\}/g, ''));
        return { index: idx, label: `${label} {{${idx}}}`, mapTo: 'contactName' as const, customValue: '' };
      }).sort((a, b) => a.index - b.index);
    };

    const body   = tpl.components.find(c => c.type === 'BODY')?.text ?? '';
    const header = tpl.components.find(c => c.type === 'HEADER')?.text ?? '';
    const btns   = tpl.components.find(c => c.type === 'BUTTONS')?.buttons ?? [];

    this.bodyVarMappings   = extractVars(body, 'Body');
    this.headerVarMappings = extractVars(header, 'Header');
    this.buttonVarMappings = btns
      .map((btn, i) => btn.type === 'URL' && btn.url?.includes('{{1}}')
        ? { index: i, label: `Button "${btn.text}" URL suffix`, mapTo: 'custom' as const, customValue: '' }
        : null
      ).filter(Boolean) as VarMapping[];
  }

  resolveVar(mapping: VarMapping, contact: Contact): string {
    if (mapping.mapTo === 'contactName') return contact.contactName;
    if (mapping.mapTo === 'contactWaId') return contact.contactWaId;
    return mapping.customValue;
  }

  // ── Step 4: Validate Schedule ─────────────────────────────────────────────
  validateSchedule(): boolean {
    this.scheduleError.set('');
    if (!this.campaignName().trim()) {
      this.scheduleError.set('Campaign name required.');
      return false;
    }
    if (this.scheduleType() === 'later') {
      if (!this.scheduleDate() || !this.scheduleTime()) {
        this.scheduleError.set('Date aur time required hai.');
        return false;
      }
      const scheduled = new Date(`${this.scheduleDate()}T${this.scheduleTime()}`);
      if (scheduled <= new Date()) {
        this.scheduleError.set('Schedule time future mein hona chahiye.');
        return false;
      }
    }
    return true;
  }

  // ── Step 5: Run Campaign ──────────────────────────────────────────────────
  startCampaign() {
    const contacts = this.selectedContacts();
    const results: CampaignResult[] = contacts.map(c => ({
      contactName: c.contactName,
      phone: c.contactWaId,
      status: 'pending'
    }));
    this.campaignResults.set(results);

    if (this.scheduleType() === 'later') {
      const scheduled = new Date(`${this.scheduleDate()}T${this.scheduleTime()}`);
      const delay = scheduled.getTime() - Date.now();
      this.scheduledTimer = setTimeout(() => this.runSend(), delay);
    } else {
      this.runSend();
    }
  }

  private async runSend() {
    this.campaignRunning.set(true);
    const contacts = this.selectedContacts();
    const tpl = this.selectedTemplate()!;
    const phoneId = this.phone_Id();

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Update status to sending
      this.campaignResults.update(rs =>
        rs.map((r, idx) => idx === i ? { ...r, status: 'sending' } : r)
      );

      const components: any[] = [];

      // Header vars
      if (this.headerVarMappings.length > 0) {
        components.push({
          type: 'header',
          parameters: this.headerVarMappings.map(v => ({
            type: 'text', text: this.resolveVar(v, contact)
          }))
        });
      }

      // Body vars
      if (this.bodyVarMappings.length > 0) {
        components.push({
          type: 'body',
          parameters: this.bodyVarMappings.map(v => ({
            type: 'text', text: this.resolveVar(v, contact)
          }))
        });
      }

      // Button vars
      for (const bv of this.buttonVarMappings) {
        const val = this.resolveVar(bv, contact);
        if (val) {
          components.push({
            type: 'button',
            sub_type: 'url',
            index: String(bv.index),
            parameters: [{ type: 'text', text: val }]
          });
        }
      }

      const payload = {
        messaging_product: 'whatsapp',
        to: contact.contactWaId,
        type: 'template',
        template: {
          name: tpl.name,
          language: { code: tpl.language || 'en_US' },
          ...(components.length > 0 ? { components } : {})
        }
      };

      try {
        await this.http.post(
          `/whatsapp-message/send/${phoneId}`,
          payload,
          { headers: this.headers, responseType: 'text' }
        ).toPromise();

        this.campaignResults.update(rs =>
          rs.map((r, idx) => idx === i ? { ...r, status: 'success' } : r)
        );
      } catch (err: any) {
        const msg = typeof err?.error === 'string'
          ? err.error
          : err?.error?.message ?? 'Failed';
        this.campaignResults.update(rs =>
          rs.map((r, idx) => idx === i ? { ...r, status: 'failed', error: msg } : r)
        );
      }

      // 1 second delay between messages (Meta rate limit)
      if (i < contacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.campaignRunning.set(false);
    this.campaignDone.set(true);
  }

  cancelScheduled() {
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }
    this.campaignRunning.set(false);
    this.campaignDone.set(false);
    this.currentStep.set(4);
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  canGoNext = computed(() => {
    switch (this.currentStep()) {
      case 1: return this.selectedContacts().length > 0;
      case 2: return this.selectedTemplate() !== null;
      case 3: return true;
      case 4: return this.campaignName().trim().length > 0;
      default: return false;
    }
  });

  goNext() {
    const step = this.currentStep();
    if (step === 2) this.buildVarMappings();
    if (step === 4) {
      if (!this.validateSchedule()) return;
      this.currentStep.set(5 as CampaignStep);
      this.startCampaign();
      return;
    }
    if (step < 4) this.currentStep.set((step + 1) as CampaignStep);
  }

  goBack() {
    const step = this.currentStep();
    if (step > 1) this.currentStep.set((step - 1) as CampaignStep);
  }

  resetCampaign() {
    this.currentStep.set(1);
    this.selectedTemplate.set(null);
    this.campaignResults.set([]);
    this.campaignDone.set(false);
    this.campaignName.set('');
    this.bodyVarMappings = [];
    this.headerVarMappings = [];
    this.buttonVarMappings = [];
    this.contacts.update(cs => cs.map(c => ({ ...c, selected: false })));
    this.csvContacts.set([]);
  }

  exportResults() {
    const rows = this.campaignResults().map(r =>
      `${r.contactName},${r.phone},${r.status},${r.error || ''}`
    );
    const csv = ['Name,Phone,Status,Error', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `campaign_${this.campaignName()}_results.csv`;
    a.click();
  }

  getBodyPreview(contact: Contact): string {
    const tpl = this.selectedTemplate();
    const body = tpl?.components.find(c => c.type === 'BODY')?.text ?? '';
    let txt = body;
    this.bodyVarMappings.forEach(v => {
      txt = txt.replace(
        new RegExp(`\\{\\{${v.index}\\}\\}`, 'g'),
        this.resolveVar(v, contact)
      );
    });
    return txt;
  }
}
