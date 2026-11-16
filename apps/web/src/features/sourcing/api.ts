import type {
  AiExpertSearchResponse, DeliverableFile, DeliverableUploadTicket, Invoice,
} from '@asteai/types';
import { api } from '@/lib/api';

export const SOURCING_KEYS = {
  wallet: '/credits/wallet',
  creditCosts: '/public-settings/credits',
  orders: '/orders',
  contracts: '/contracts',
  invoices: '/invoices',
  files: (q: { orderId?: string; contractId?: string }) =>
    q.orderId ? `/deliverables?orderId=${encodeURIComponent(q.orderId)}` : `/deliverables?contractId=${encodeURIComponent(q.contractId ?? '')}`,
} as const;

export const sourcingApi = {
  aiSearch: (body: { query: string; source: 'text' | 'voice'; language?: string; limit?: number }) =>
    api.post<AiExpertSearchResponse>('/experts/ai-search', body),
  uploadUrl: (body: { orderId?: string; contractId?: string; milestoneId?: string; fileName: string; contentType: string; sizeBytes: number }) =>
    api.post<DeliverableUploadTicket>('/deliverables/upload-url', body),
};

/** PUTs a deliverable straight to S3 with the ticket's signed headers, reporting progress. */
export function putFile(ticket: DeliverableUploadTicket, file: File, onProgress?: (f: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(ticket.method, ticket.url);
    for (const [k, v] of Object.entries(ticket.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(file);
  });
}

export type { DeliverableFile, Invoice };
