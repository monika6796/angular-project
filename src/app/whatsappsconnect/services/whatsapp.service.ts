import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  EmbeddedSignupCallbackDto,
  WhatsAppConnectResponse
} from '../models/whatsapp.models';

@Injectable({ providedIn: 'root' })
export class WhatsAppService {
  private readonly base = '/whatsapp';

  constructor(private http: HttpClient) {}

  connect(dto: EmbeddedSignupCallbackDto): Observable<WhatsAppConnectResponse> {
    return this.http.post<WhatsAppConnectResponse>(
      `${this.base}/connect`, dto
    );
  }

  getStatus(): Observable<WhatsAppConnectResponse> {
    return this.http.get<WhatsAppConnectResponse>(
      `${this.base}/status`
    );
  }

  disconnect(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/disconnect`, {}
    );
  }
}