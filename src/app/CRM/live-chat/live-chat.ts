import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Component, OnInit, OnDestroy,
  ViewChild, ElementRef, HostListener,
  ChangeDetectorRef, NgZone
} from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { HttpClient, HttpHeaders } from '@angular/common/http';

// Backend enum ke saath exactly match karta hai
export enum MessageMediaType {
  Text     = 0,
  Image    = 1,
  Document = 2,
  Video    = 3,
}

export interface Conversation {
  id: number;
  contactWaId: string;
  contactName: string;
  lastMessagePreview?: string;
  lastMessageAt: Date;
  unreadCount: number;
  isActive: boolean;
  isOnline?: boolean;
  sessionEnded?: boolean;
}

export interface Message {
  id: number;
  waMessageId: string;
  direction: 'inbound' | 'outbound';
  messageType: string;
  textBody?: string;
  mediaId?: string;
  mediaCaption?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  reactionEmoji?: string;
  contextMessageId?: string;
  status?: string;
  timestamp: Date;
  showDateSeparator?: boolean;
}

export interface PendingAttach {
  mediaType: MessageMediaType;
  mediaUrl:  string;
  caption:   string;
  filename:  string;
  previewUrl: string; // local blob URL sirf image/video ke liye
}

@Component({
  selector: 'app-live-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './live-chat.html',
  styleUrl: './live-chat.css',
})
export class LiveChat implements OnInit, OnDestroy {

  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;
  @ViewChild('convListEl') convListEl!: ElementRef<HTMLDivElement>;
  @ViewChild('msgInput')   msgInput!:   ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput')  fileInput!:  ElementRef<HTMLInputElement>;

  // ── Enum reference for template ──────────────
  readonly MsgType = MessageMediaType;

  // ── Dynamic WABA / Phone selector ────────────
  selectedWabaId        = '';
  selectedPhoneNumberId = '';
  wabaList:  { id: string; name: string }[]    = [];
  phoneList: { id: string; display: string }[] = [];
  private allWabaData: any[] = [];

  // ── Attach panel state ────────────────────────
  showAttachMenu  = false;
  pendingAttach:  PendingAttach | null = null;

  conversations:         Conversation[] = [];
  filteredConversations: Conversation[] = [];
  selectedConv:          Conversation | null = null;
  messages:              Message[] = [];

  searchQuery  = '';
  messageText  = '';
  sending      = false;
  isTyping     = false;
  isMobile     = false;
  isMobileChat = false;

  sidebarCollapsed = false;

  loadingConversations     = false;
  loadingMoreConversations = false;
  loadingMessages          = false;
  hasMoreMessages          = false;

  isConnected    = false;
  isReconnecting = false;

  conversationStartDate: Date | null = null;

  private convPage     = 1;
  private convPageSize = 20;
  private hasMoreConvs = true;
  private olderCursor: number | null = null;

  private hubConnection: signalR.HubConnection | null = null;
  private token = localStorage.getItem('token') ?? '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.checkMobile();
    this.loadWabaData();
    this.startSignalR();
  }

  ngOnDestroy(): void {
    this.hubConnection?.stop();
    if (this.pendingAttach?.previewUrl) {
      URL.revokeObjectURL(this.pendingAttach.previewUrl);
    }
  }

  @HostListener('window:resize')
  onResize(): void { this.checkMobile(); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.attach-wrap')) {
      this.showAttachMenu = false;
    }
  }

  private checkMobile(): void {
    this.isMobile = window.innerWidth < 768;
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────
  // WABA / Phone selector
  // ─────────────────────────────────────────────

  loadWabaData(): void {
    this.http.get<any[]>('get_whatsapp/data', {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${this.token}` })
    }).subscribe({
      next: res => {
        this.allWabaData = res;
        this.wabaList    = [];
        res.forEach(biz => {
          (biz.WhatsappBusinessAccounts || []).forEach((w: any) => {
            this.wabaList.push({
              id:   w.Whatsapp_Business_Account_Id,
              name: w.Whatsapp_Business_Account_Name
            });
          });
        });
        if (this.wabaList.length > 0) {
          this.selectedWabaId = this.wabaList[0].id;
        }
        this.onWabaChange();
        this.cdr.markForCheck();
      },
      error: err => console.error('WABA data load failed', err)
    });
  }

  onWabaChange(): void {
    this.phoneList = [];
    this.allWabaData.forEach(biz => {
      (biz.WhatsappBusinessAccounts || []).forEach((w: any) => {
        if (w.Whatsapp_Business_Account_Id === this.selectedWabaId) {
          (w.PhoneNumbers || []).forEach((p: any) => {
            this.phoneList.push({ id: p.Phone_number_id, display: p.Display_phone_number });
          });
        }
      });
    });
    if (this.phoneList.length > 0) {
      this.selectedPhoneNumberId = this.phoneList[0].id;
    }
    this.loadConversations(true);
  }

  // ─────────────────────────────────────────────
  // Attach Panel
  // ─────────────────────────────────────────────

  toggleAttachMenu(e: MouseEvent): void {
    e.stopPropagation();
    this.showAttachMenu = !this.showAttachMenu;
    this.cdr.markForCheck();
  }

  // File picker open karo — image ya video ya document
  openFilePicker(accept: string): void {
    this.showAttachMenu = false;
    const el = this.fileInput?.nativeElement;
    if (!el) return;
    el.accept = accept;
    el.value  = '';
    el.click();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isDoc   = !isImage && !isVideo;

    // NOTE: Production mein file ko pehle server pe upload karo
    // aur mediaId/mediaUrl wahan se lo.
    // Abhi ke liye blob URL use ho raha hai preview ke liye.
    const blobUrl = URL.createObjectURL(file);

    if (this.pendingAttach?.previewUrl) {
      URL.revokeObjectURL(this.pendingAttach.previewUrl);
    }

    this.pendingAttach = {
      mediaType:  isImage ? MessageMediaType.Image
                : isVideo ? MessageMediaType.Video
                : MessageMediaType.Document,
      mediaUrl:   blobUrl,   // production: real URL yahan aayega
      caption:    '',
      filename:   file.name,
      previewUrl: blobUrl,
    };
    this.cdr.markForCheck();
  }

  cancelAttach(): void {
    if (this.pendingAttach?.previewUrl) {
      URL.revokeObjectURL(this.pendingAttach.previewUrl);
    }
    this.pendingAttach = null;
    this.cdr.markForCheck();
  }

  // ─────────────────────────────────────────────
  // SignalR
  // ─────────────────────────────────────────────

  private startSignalR(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/chat', { accessTokenFactory: () => this.token })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.hubConnection.on('NewMessage', (msg: any) =>
      this.zone.run(() => this.onNewMessage(msg)));

    this.hubConnection.on('ConversationUpdated', (conv: any) =>
      this.zone.run(() => this.onConversationUpdated(conv)));

    this.hubConnection.on('MessageStatusChanged', (evt: any) =>
      this.zone.run(() => this.onMessageStatusChanged(evt)));

    this.hubConnection.onreconnecting(() => this.zone.run(() => {
      this.isConnected = false; this.isReconnecting = true;
      this.cdr.markForCheck();
    }));

    this.hubConnection.onreconnected(async () => this.zone.run(async () => {
      this.isConnected = true; this.isReconnecting = false;
      await this.hubConnection!.invoke('JoinWaba', this.selectedWabaId);
      this.cdr.markForCheck();
    }));

    this.hubConnection.onclose(() => this.zone.run(() => {
      this.isConnected = false; this.isReconnecting = false;
      this.cdr.markForCheck();
    }));

    this.hubConnection.start()
      .then(async () => {
        this.isConnected = true;
        await this.hubConnection!.invoke('JoinWaba', this.selectedWabaId);
        this.cdr.markForCheck();
      })
      .catch((err: any) => console.error('SignalR connection failed:', err));
  }

  private onNewMessage(msg: any): void {
    const conv = this.conversations.find(c => c.id === msg.conversationId);
    if (conv) {
      conv.lastMessagePreview = msg.preview;
      conv.lastMessageAt      = new Date(msg.timestamp);
      if (msg.direction === 'inbound' && this.selectedConv?.id !== conv.id) conv.unreadCount++;
      this.conversations = [conv, ...this.conversations.filter(c => c.id !== conv.id)];
      this.applySearch();
    } else {
      this.refreshConversations();
    }

    if (this.selectedConv?.id === msg.conversationId) {
      const message: Message = {
        id: 0, waMessageId: msg.messageId,
        direction: msg.direction, messageType: msg.messageType,
        textBody: msg.textBody, mediaCaption: msg.mediaCaption,
        mediaMimeType: msg.mediaMimeType, mediaFilename: msg.mediaFilename,
        status: 'sent', timestamp: new Date(msg.timestamp),
      };
      this.messages.push(message);
      this.scrollToBottom();
    }
    this.cdr.markForCheck();
  }

  private onConversationUpdated(conv: any): void {
    const existing = this.conversations.find(c => c.id === conv.conversationId);
    if (existing) {
      existing.lastMessagePreview = conv.lastMessagePreview;
      existing.lastMessageAt      = new Date(conv.lastMessageAt);
      if (conv.unreadCount >= 0) existing.unreadCount = conv.unreadCount;
    }
    this.applySearch();
    this.cdr.markForCheck();
  }

  private onMessageStatusChanged(evt: any): void {
    const msg = this.messages.find(m => m.waMessageId === evt.waMessageId);
    if (msg) { msg.status = evt.status; this.cdr.markForCheck(); }
  }

  // ─────────────────────────────────────────────
  // Conversations
  // ─────────────────────────────────────────────

  loadConversations(reset = false): void {
    if (reset) { this.convPage = 1; this.conversations = []; this.hasMoreConvs = true; }
    if (!this.hasMoreConvs) return;
    if (!this.selectedWabaId || !this.selectedPhoneNumberId) return;
    this.loadingConversations = true;

    const params = new URLSearchParams({
      wabaId:        this.selectedWabaId,
      phoneNumberId: this.selectedPhoneNumberId,
      page:          this.convPage.toString(),
      pageSize:      this.convPageSize.toString(),
    });
    if (this.searchQuery) params.set('search', this.searchQuery);

    this.http.get<any>(`/whatsapp/chat/conversations?${params}`, this.headers()).subscribe({
      next: res => {
        const mapped: Conversation[] = res.items.map((c: any) => ({
          ...c, lastMessageAt: new Date(c.lastMessageAt), sessionEnded: !c.isActive,
        }));
        this.conversations = [...this.conversations, ...mapped];
        this.hasMoreConvs  = res.hasMore;
        this.convPage++;
        this.loadingConversations = this.loadingMoreConversations = false;
        this.applySearch();
        this.cdr.markForCheck();
      },
      error: err => {
        console.error('Failed to load conversations', err);
        this.loadingConversations = this.loadingMoreConversations = false;
        this.cdr.markForCheck();
      }
    });
  }

  private refreshConversations(): void { this.loadConversations(true); }

  onConvScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100
        && !this.loadingMoreConversations && this.hasMoreConvs) {
      this.loadingMoreConversations = true;
      this.loadConversations();
    }
  }

  applySearch(): void {
    const q = this.searchQuery.toLowerCase();
    this.filteredConversations = q
      ? this.conversations.filter(c =>
          c.contactName.toLowerCase().includes(q) ||
          c.contactWaId.includes(q) ||
          c.lastMessagePreview?.toLowerCase().includes(q))
      : [...this.conversations];
  }

  onSearch(): void {
    if (this.searchQuery.length === 0 || this.searchQuery.length > 1) this.applySearch();
  }

  // ─────────────────────────────────────────────
  // Select conversation
  // ─────────────────────────────────────────────

  selectConversation(conv: Conversation): void {
    this.selectedConv          = conv;
    this.messages              = [];
    this.olderCursor           = null;
    this.hasMoreMessages       = false;
    this.isMobileChat          = true;
    this.conversationStartDate = null;
    conv.unreadCount           = 0;
    this.cancelAttach();

    if (!this.isMobile) this.sidebarCollapsed = false;

    this.http.put(`/whatsapp/chat/conversations/${conv.id}/read`, {}, this.headers()).subscribe();
    this.loadMessages();
    this.cdr.markForCheck();
  }

  goBack(): void {
    this.isMobileChat     = false;
    this.selectedConv     = null;
    this.sidebarCollapsed = false;
    this.cancelAttach();
  }

  // ─────────────────────────────────────────────
  // Messages
  // ─────────────────────────────────────────────

  loadMessages(prepend = false): void {
    if (!this.selectedConv) return;
    this.loadingMessages = true;

    const params = new URLSearchParams({ limit: '50' });
    if (this.olderCursor) params.set('before', this.olderCursor.toString());

    this.http.get<any>(
      `/whatsapp/chat/conversations/${this.selectedConv.id}/messages?${params}`,
      this.headers()
    ).subscribe({
      next: res => {
        const mapped: Message[] = res.items.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
        this.addDateSeparators(mapped);

        if (prepend) {
          this.messages = [...mapped, ...this.messages];
        } else {
          this.messages = mapped;
          setTimeout(() => this.scrollToBottom(), 50);
        }

        this.hasMoreMessages = res.hasMore;
        this.olderCursor     = res.nextCursor ?? null;
        this.loadingMessages = false;
        if (this.messages.length > 0) this.conversationStartDate = this.messages[0].timestamp;
        this.cdr.markForCheck();
      },
      error: err => {
        console.error('Failed to load messages', err);
        this.loadingMessages = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadOlderMessages(): void {
    if (!this.hasMoreMessages || this.loadingMessages) return;
    const scrollEl = this.messagesEl?.nativeElement;
    const prevScrollHeight = scrollEl?.scrollHeight ?? 0;
    this.loadMessages(true);
    setTimeout(() => { if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight; }, 100);
  }

  onMessagesScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop < 80 && this.hasMoreMessages && !this.loadingMessages) this.loadOlderMessages();
  }

  private addDateSeparators(messages: Message[]): void {
    let lastDate = '';
    messages.forEach(msg => {
      const d = new Date(msg.timestamp).toDateString();
      msg.showDateSeparator = d !== lastDate;
      lastDate = d;
    });
  }

  // ─────────────────────────────────────────────
  // Send — Text + Image + Document + Video
  // Endpoint: POST /whatsapp/chat/send/{phoneNumberId}
  // Body: WhatsappUnifiedMessageRequest
  // ─────────────────────────────────────────────

  sendMessage(): void {
    if (!this.selectedConv || this.sending) return;

    // Attachment pending hai — media send karo
    if (this.pendingAttach) {
      this.sendMedia();
      return;
    }

    // Sirf text
    if (!this.messageText.trim()) return;
    const text = this.messageText.trim();
    this.messageText = '';
    this.resetTextarea();
    this.sending = true;

    const body = {
      to:        this.selectedConv.contactWaId,
      mediaType: MessageMediaType.Text,   // 0
      text:      text,
    };

    this.http.post<any>(
      `/whatsapp/chat/send/${this.selectedPhoneNumberId}`,
      body,
      this.headers()
    ).subscribe({
      next: () => { this.sending = false; this.cdr.markForCheck(); },
      error: err => {
        console.error('Send failed', err);
        this.sending = false;
        this.messageText = text;
        this.cdr.markForCheck();
      }
    });
  }

  private sendMedia(): void {
    if (!this.selectedConv || !this.pendingAttach) return;
    this.sending = true;

    const attach = this.pendingAttach;

    const body: any = {
      to:        this.selectedConv.contactWaId,
      mediaType: attach.mediaType,       // 1=Image, 2=Document, 3=Video
      mediaUrl:  attach.mediaUrl,
    };

    if (attach.caption)  body['caption']  = attach.caption;
    if (attach.filename) body['filename'] = attach.filename;

    this.http.post<any>(
      `/whatsapp/chat/send/${this.selectedPhoneNumberId}`,
      body,
      this.headers()
    ).subscribe({
      next: () => {
        this.sending = false;
        this.cancelAttach();
        this.cdr.markForCheck();
      },
      error: err => {
        console.error('Media send failed', err);
        this.sending = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Send button enable condition
  get canSend(): boolean {
    if (this.sending) return false;
    if (this.pendingAttach) return true;
    return this.messageText.trim().length > 0;
  }

  onEnterKey(event: any): void {
    if (!event.shiftKey) { event.preventDefault(); this.sendMessage(); }
  }

  onInputChange(): void { this.autoResizeTextarea(); }

  private autoResizeTextarea(): void {
    const el = this.msgInput?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  private resetTextarea(): void {
    const el = this.msgInput?.nativeElement;
    if (el) el.style.height = 'auto';
  }

  trackByMsgId(_: number, msg: Message): number {
    return msg.id || msg.waMessageId as any;
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  private headers() {
    return {
      headers: new HttpHeaders({
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.token}`
      })
    };
  }
}
