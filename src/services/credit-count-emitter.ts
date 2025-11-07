import { EventEmitter } from 'node:events';

export interface CreditCountEvent {
  companyId: number;
  creditCount: number;
}

class CreditCountEventEmitter extends EventEmitter {
  emitCreditCountChange(companyId: number, creditCount: number) {
    this.emit(`creditCount:${companyId}`, creditCount);
  }
}

export const creditCountEmitter = new CreditCountEventEmitter();
