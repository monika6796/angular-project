export interface EmbeddedSignupCallbackDto {
  code: string;
  wabaId: string;
}

export interface PhoneNumberResponse {
  phoneNumberId: string;
  phoneNumber: string;
  displayName: string;
  qualityRating: string;
  isWebhookSubscribed: boolean;
}

export interface WhatsAppConnectResponse {
  isConnected: boolean;
  wabaId: string;
  businessName: string;
  phoneNumbers: PhoneNumberResponse[];
}