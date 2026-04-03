import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { CreateTempalte } from '../create-tempalte/create-tempalte';

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
  selected: boolean;
  components: TemplateComponent[];
  parameter_format?: string;
}

interface ApiResponse {
  data: WhatsappTemplate[];
  paging: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

export interface VarSlot {
  index: number;
  label: string;
  value: string;
}

@Component({
  selector: 'whatsapp-templates',
  standalone: true,
  imports: [CommonModule, FormsModule,CreateTempalte],
  templateUrl: './templates.html',
  styleUrl: './templates.css',
})
export class Templates implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  // ── Delete notification ──────────────────────────────────
deleteNotif = signal<{ name: string; type: 'success' | 'error'; msg: string } | null>(null);

  searchQuery = signal('');
  selectAll   = signal(false);
  loading     = signal(false);
  error       = signal('');
  nextCursor  = signal('');
  hasMore     = signal(false);
  wabaId      = signal('');
  phone_Id    = signal('');
  templates   = signal<WhatsappTemplate[]>([]);
  createModalOpen = signal(false);

  // ── Preview modal ────────────────────────────────────────
  modalOpen       = signal(false);
  previewTemplate = signal<WhatsappTemplate | null>(null);

  // ── Send modal ───────────────────────────────────────────
  sendModalOpen   = signal(false);
  sendTemplate    = signal<WhatsappTemplate | null>(null);
  sendLoading     = signal(false);
  sendSuccess     = signal('');
  sendError       = signal('');

  sendBodyVars:   VarSlot[] = [];
  sendHeaderVars: VarSlot[] = [];
  sendButtonVars: VarSlot[] = [];

  private _sendPhoneNumber = signal('');
  get phoneNumberModel(): string { return this._sendPhoneNumber(); }
  set phoneNumberModel(v: string) { this._sendPhoneNumber.set(v); }

  // ── JSON modal ───────────────────────────────────────────
  jsonModalOpen = signal(false);
  jsonTemplate  = signal<WhatsappTemplate | null>(null);
  jsonCopied    = signal(false);

  // ── Filtered list ────────────────────────────────────────
  filteredTemplates = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.templates().filter((t) => t.name.toLowerCase().includes(q));
  });

  // ── Component getters (preview modal) ────────────────────
  get headerComp(): TemplateComponent | undefined {
    return this.previewTemplate()?.components.find(c => c.type === 'HEADER');
  }
  get bodyComp(): TemplateComponent | undefined {
    return this.previewTemplate()?.components.find(c => c.type === 'BODY');
  }
  get footerComp(): TemplateComponent | undefined {
    return this.previewTemplate()?.components.find(c => c.type === 'FOOTER');
  }
  get buttonsComp(): TemplateComponent | undefined {
    return this.previewTemplate()?.components.find(c => c.type === 'BUTTONS');
  }

  // ── Component getters (send modal) ───────────────────────
  get sendHeaderComp(): TemplateComponent | undefined {
    return this.sendTemplate()?.components.find(c => c.type === 'HEADER');
  }
  get sendBodyComp(): TemplateComponent | undefined {
    return this.sendTemplate()?.components.find(c => c.type === 'BODY');
  }
  get sendFooterComp(): TemplateComponent | undefined {
    return this.sendTemplate()?.components.find(c => c.type === 'FOOTER');
  }
  get sendButtonsComp(): TemplateComponent | undefined {
    return this.sendTemplate()?.components.find(c => c.type === 'BUTTONS');
  }

  // ── Live preview rendered text (send modal) ──────────────
  get sendBodyPreview(): string {
    const body = this.sendBodyComp;
    if (!body?.text) return '';
    let txt = body.text;
    this.sendBodyVars.forEach(v => {
      txt = txt.replace(new RegExp(`\\{\\{${v.index}\\}\\}`, 'g'),
        v.value
          ? `<span class="tpl-var">${this.esc(v.value)}</span>`
          : `<span class="tpl-ph">{{${v.index}}}</span>`
      );
    });
    return txt.replace(/\n/g, '<br>');
  }

  get sendHeaderPreview(): string {
    const header = this.sendHeaderComp;
    if (!header?.text) return '';
    let txt = header.text;
    this.sendHeaderVars.forEach(v => {
      txt = txt.replace(new RegExp(`\\{\\{${v.index}\\}\\}`, 'g'),
        v.value
          ? `<span class="tpl-var">${this.esc(v.value)}</span>`
          : `<span class="tpl-ph">{{${v.index}}}</span>`
      );
    });
    return txt;
  }

  // ── Static preview helpers (preview modal) ───────────────
  get bodyWithExamples(): string {
    const body = this.bodyComp;
    if (!body?.text) return '';
    const examples = body.example?.body_text?.[0] ?? [];
    return body.text
      .replace(/\n/g, '<br>')
      .replace(/\{\{(\d+)\}\}/g, (_, i) => {
        const val = examples[parseInt(i) - 1];
        return val
          ? `<span class="tpl-var">${val}</span>`
          : `<span class="tpl-ph">{{${i}}}</span>`;
      });
  }

  get headerWithExamples(): string {
    const header = this.headerComp;
    if (!header?.text) return '';
    const examples = header.example?.header_text ?? [];
    return header.text.replace(/\{\{(\d+)\}\}/g, (_, i) => {
      const val = examples[parseInt(i) - 1];
      return val
        ? `<span class="tpl-var">${val}</span>`
        : `<span class="tpl-ph">{{${i}}}</span>`;
    });
  }

  // ── JSON payload getter ──────────────────────────────────
  get jsonPayload(): string {
    const t = this.jsonTemplate();
    if (!t) return '';

    const components: any[] = [];

    t.components.forEach(comp => {
      if (comp.type === 'HEADER') {
        if (
          comp.format === 'IMAGE' ||
          comp.format === 'VIDEO' ||
          comp.format === 'DOCUMENT'
        ) {
          const fmt = comp.format.toLowerCase();
          components.push({
            type: 'header',
            parameters: [{ type: fmt, [fmt]: { link: '<MEDIA_URL>' } }]
          });
        } else if (comp.text) {
          const vars = [...new Set((comp.text.match(/\{\{(\d+)\}\}/g) || []))];
          if (vars.length > 0) {
            components.push({
              type: 'header',
              parameters: vars.map((_, i) => ({
                type: 'text',
                text: `<header_var_${i + 1}>`
              }))
            });
          }
        }
      }

      if (comp.type === 'BODY' && comp.text) {
        const vars = [...new Set((comp.text.match(/\{\{(\d+)\}\}/g) || []))];
        if (vars.length > 0) {
          components.push({
            type: 'body',
            parameters: vars.map((_, i) => ({
              type: 'text',
              text: `<body_var_${i + 1}>`
            }))
          });
        }
      }

      if (comp.type === 'BUTTONS' && comp.buttons) {
        comp.buttons.forEach((btn, i) => {
          if (btn.type === 'URL' && btn.url?.includes('{{1}}')) {
            components.push({
              type: 'button',
              sub_type: 'url',
              index: String(i),
              parameters: [{ type: 'text', text: '<url_suffix>' }]
            });
          }
        });
      }
    });

    const payload = {
      messaging_product: 'whatsapp',
      to: '<PHONE_NUMBER>',
      type: 'template',
      template: {
        name: t.name,
        language: { code: t.language },
        ...(components.length > 0 ? { components } : {})
      }
    };

    return JSON.stringify(payload, null, 2);
  }

  // ── Lifecycle ────────────────────────────────────────────
  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const id  = params['Whatsapp_Business_Account_Id'] || '';
      const pId = params['Phone_number_id'] || '';
      this.phone_Id.set(pId);
      this.wabaId.set(id);
      if (id) this.fetchTemplates();
    });
  }

  private getToken(): string {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private extractVars(text: string, labelPrefix: string): VarSlot[] {
    const matches = [...new Set((text.match(/\{\{(\d+)\}\}/g) || []))];
    return matches.map(m => {
      const idx = parseInt(m.replace(/\{\{|\}\}/g, ''));
      return { index: idx, label: `${labelPrefix} Variable {{${idx}}}`, value: '' };
    }).sort((a, b) => a.index - b.index);
  }

  // ── API ──────────────────────────────────────────────────
  fetchTemplates(cursor: string = '') {
    this.loading.set(true);
    this.error.set('');

    const headers = new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
    let url = `/whatsapp/${this.wabaId()}?limit=10`;
    if (cursor) url += `&after=${cursor}`;

    this.http.get<any>(url, { headers }).subscribe({
      next: (res) => {
        const response: ApiResponse = Array.isArray(res) ? res[0] : res;
        if (!response?.data) {
          this.error.set('API se unexpected response aaya.');
          this.loading.set(false);
          return;
        }
        const mapped: WhatsappTemplate[] = response.data.map((t) => ({
          id:               t.id,
          name:             t.name,
          category:         t.category,
          language:         t.language,
          status:           t.status,
          selected:         false,
          components:       t.components ?? [],
          parameter_format: t.parameter_format,
        }));
        if (cursor) this.templates.update((p) => [...p, ...mapped]);
        else        this.templates.set(mapped);
        this.nextCursor.set(response.paging?.cursors?.after || '');
        this.hasMore.set(!!response.paging?.next);
        this.loading.set(false);
      },
      error: (err) => {
        const m: Record<number, string> = {
          0:   '❌ Server not connected',
          401: '🔐 Token invalid/expire (401).',
          403: '🚫 Access denied (403).',
          404: '🔍 Route not found (404).',
          500: '💥 Server error (500).',
        };
        this.error.set(m[err.status] ?? `Error ${err.status}: ${err.message}`);
        this.loading.set(false);
      },
    });
  }

  loadMore() {
    if (this.nextCursor()) this.fetchTemplates(this.nextCursor());
  }

  // ── Preview Modal ────────────────────────────────────────
  openModal(template: WhatsappTemplate) {
    this.previewTemplate.set(template);
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    setTimeout(() => this.previewTemplate.set(null), 280);
  }

  getCurrentTime(): string {
    const n = new Date();
    return n.getHours().toString().padStart(2, '0') + ':' +
           n.getMinutes().toString().padStart(2, '0');
  }

  // ── Send Modal ───────────────────────────────────────────
  openSendModal(template: WhatsappTemplate) {
    this.sendTemplate.set(template);
    this._sendPhoneNumber.set('');
    this.sendSuccess.set('');
    this.sendError.set('');

    const bodyText = template.components.find(c => c.type === 'BODY')?.text ?? '';
    this.sendBodyVars = this.extractVars(bodyText, 'Body');

    const headerComp = template.components.find(c => c.type === 'HEADER');
    const headerText = (headerComp?.format === 'TEXT' || !headerComp?.format)
      ? (headerComp?.text ?? '') : '';
    this.sendHeaderVars = this.extractVars(headerText, 'Header');

    const buttons = template.components.find(c => c.type === 'BUTTONS')?.buttons ?? [];
    const urlBtnVars: VarSlot[] = [];
    buttons.forEach((btn, i) => {
      if (btn.type === 'URL' && btn.url?.includes('{{1}}')) {
        urlBtnVars.push({ index: i, label: `Button "${btn.text}" URL suffix`, value: '' });
      }
    });
    this.sendButtonVars = urlBtnVars;
    this.sendModalOpen.set(true);
  }

  closeSendModal() {
    this.sendModalOpen.set(false);
    setTimeout(() => {
      this.sendTemplate.set(null);
      this.sendBodyVars   = [];
      this.sendHeaderVars = [];
      this.sendButtonVars = [];
    }, 280);
  }

  // ── JSON Modal ───────────────────────────────────────────
  onJson(t: WhatsappTemplate) {
    this.jsonTemplate.set(t);
    this.jsonModalOpen.set(true);
    this.jsonCopied.set(false);
  }

  closeJsonModal() {
    this.jsonModalOpen.set(false);
    setTimeout(() => this.jsonTemplate.set(null), 280);
  }

  copyJson() {
    navigator.clipboard.writeText(this.jsonPayload).then(() => {
      this.jsonCopied.set(true);
      setTimeout(() => this.jsonCopied.set(false), 2000);
    });
  }

  submitSend() {
  const template = this.sendTemplate();
  if (!template) return;

  const phone = this._sendPhoneNumber().trim().replace(/\D/g, '');
  if (!phone) { this.sendError.set('Phone number required.'); return; }
  if (phone.length < 10) {
    this.sendError.set('Invalid phone number — at least 10 digits required.');
    return;
  }

  this.sendLoading.set(true);
  this.sendSuccess.set('');
  this.sendError.set('');

  const components: any[] = [];

  // Header
  const hComp = template.components.find(c => c.type === 'HEADER');
  if (hComp) {
    if ((hComp.format === 'TEXT' || !hComp.format) && this.sendHeaderVars.length > 0) {
      for (const v of this.sendHeaderVars) {
        if (!v.value || v.value.trim() === '') {
          this.sendLoading.set(false);
          this.sendError.set(`❌ "${v.label}" fill karna zaroori hai.`);
          return;
        }
      }
      components.push({
        type: 'header',
        parameters: this.sendHeaderVars.map(v => ({ type: 'text', text: v.value.trim() }))
      });
    } else if (hComp.format === 'IMAGE') {
      const handle = hComp.example?.header_handle?.[0];
      if (handle) {
        components.push({
          type: 'header',
          parameters: [{ type: 'image', image: { link: handle } }]
        });
      }
    }
  }

  // Body
  if (this.sendBodyVars.length > 0) {
    for (const v of this.sendBodyVars) {
      if (!v.value || v.value.trim() === '') {
        this.sendLoading.set(false);
        this.sendError.set(`❌ "${v.label}" fill karna zaroori hai.`);
        return;
      }
    }
    components.push({
      type: 'body',
      parameters: this.sendBodyVars.map(v => ({ type: 'text', text: v.value.trim() }))
    });
  }

  // Buttons
  for (const bv of this.sendButtonVars) {
    if (!bv.value || bv.value.trim() === '') {
      this.sendLoading.set(false);
      this.sendError.set(`❌ "${bv.label}" fill karna zaroori hai.`);
      return;
    }
    components.push({
      type: 'button',
      sub_type: 'url',
      index: String(bv.index),
      parameters: [{ type: 'text', text: bv.value.trim() }]
    });
  }

  // Payload — Meta format
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language || 'en_US' },
      ...(components.length > 0 ? { components } : {})
    }
  };

  const headers = new HttpHeaders({
    'Authorization': `Bearer ${this.getToken()}`,
    'Content-Type':  'application/json'
  });

  this.http.post(`/whatsapp-message/send/${this.phone_Id()}`, payload,
    { headers, responseType: 'text' }
  ).subscribe({
    next: () => {
      this.sendLoading.set(false);
      this.sendSuccess.set('✅ Message sent successfully!');
    },
    error: (err) => {
      this.sendLoading.set(false);
      const msg = typeof err?.error === 'string'
        ? err.error
        : err?.error?.error ?? err?.error?.message ?? err.message ?? 'Unknown error';
      this.sendError.set(`❌ ${msg}`);
    }
  });
}
  // ── Table helpers ────────────────────────────────────────
  onSearchChange(v: string) { this.searchQuery.set(v); }

  toggleSelectAll(checked: boolean) {
    this.selectAll.set(checked);
    this.templates.update((t) => t.map((x) => ({ ...x, selected: checked })));
  }

  toggleRow(id: string, checked: boolean) {
    this.templates.update((t) =>
      t.map((x) => (x.id === id ? { ...x, selected: checked } : x))
    );
    this.selectAll.set(this.templates().every((t) => t.selected));
  }

  // ── Actions ──────────────────────────────────────────────
  onView(t: WhatsappTemplate)      { this.openModal(t); }
  onSend(t: WhatsappTemplate)      { this.openSendModal(t); }
  onCode(t: WhatsappTemplate)      { alert(`Code for: ${t.name}`); }
  onAnalytics(t: WhatsappTemplate) { alert(`Analytics for: ${t.name}`); }
  onEdit(t: WhatsappTemplate)      { alert(`Edit: ${t.name}`); }

  onClone(t: WhatsappTemplate) {
    this.templates.update((arr) => [
      ...arr,
      { ...t, id: Date.now().toString(), name: t.name + ' (copy)', selected: false },
    ]);
  }

  onDelete(id: string) {
  const template = this.templates().find(t => t.id === id);
  if (!template) return;

  if (!confirm(`"${template.name}" Are u sure deleted?`)) return;

  const headers = new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
  const url = `/whatsapp/delete?wabaId=${this.wabaId()}&templateName=${template.name}&language=${template.language}`;

  this.http.delete(url, { headers, responseType: 'text' }).subscribe({
    next: () => {
      // UI se remove karo
      this.templates.update(arr => arr.filter(x => x.id !== id));
      // Success notification
      this.deleteNotif.set({ name: template.name, type: 'success', msg: `✅ "${template.name}" deleted successfully!` });
      setTimeout(() => this.deleteNotif.set(null), 4000);
    },
    error: (err) => {
      const msg = typeof err?.error === 'string'
        ? err.error
        : err?.error?.message ?? err.message ?? 'Unknown error';
      this.deleteNotif.set({ name: template.name, type: 'error', msg: `❌ Delete failed: ${msg}` });
      setTimeout(() => this.deleteNotif.set(null), 5000);
    }
  });
}

  onOpenTemplateLibrary() { alert('Open Template Library'); }
  onAITemplateBuilder()   { alert('AI Template Builder'); }
  onCreateTemplate() { this.createModalOpen.set(true); }
  onBulkCloneTemplates()  { alert('Bulk Clone Templates'); }
  onFilters()             { alert('Filters'); }
  onSyncTemplates()       { this.fetchTemplates(); }
  onRefresh()             { this.fetchTemplates(); }
}