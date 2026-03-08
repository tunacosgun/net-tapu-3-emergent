import { BadRequestException } from '@nestjs/common';
import { PosCallbackService } from '../pos-callback.service';
import { PaymentStatus } from '@nettapu/shared';

/**
 * Unit tests for HIGH priority security fixes in PosCallbackService:
 *   Fix 1: iyzico callback token must match posTransactionToken in DB
 *   Fix 2: Callback amount cross-check for PayTR (kuruş) and iyzico (decimal)
 */

// Minimal mock helpers
function createMockPayment(overrides: Partial<any> = {}): any {
  return {
    id: 'pay-001',
    amount: '100.50',
    currency: 'TRY',
    status: PaymentStatus.AWAITING_3DS,
    posTransactionToken: 'tok-abc-123',
    ...overrides,
  };
}

function createMockQueryRunner(lockedPayment: any) {
  const qr: any = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isTransactionActive: true,
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(lockedPayment),
      }),
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((_entity: any, data: any) => data),
    },
  };
  return qr;
}

function createService(overrides: Partial<any> = {}): PosCallbackService {
  const paymentRepo = { findOne: jest.fn() };
  const posGateway = {
    verifyCallback: jest.fn().mockReturnValue(true),
    completeProvision: jest.fn().mockResolvedValue({
      success: true,
      posReference: 'pos-ref-001',
      message: 'OK',
    }),
    ...overrides.posGateway,
  };
  const dataSource = {
    createQueryRunner: jest.fn().mockReturnValue(
      overrides.queryRunner ?? createMockQueryRunner(createMockPayment()),
    ),
  };

  const configService = { get: jest.fn().mockReturnValue('mock') };

  return new PosCallbackService(
    paymentRepo as any,
    posGateway as any,
    dataSource as any,
    configService as any,
  );
}

// ─── Fix 2: checkAmountMismatch ─────────────────────────────

describe('PosCallbackService.checkAmountMismatch', () => {
  let service: PosCallbackService;

  beforeEach(() => {
    service = createService();
  });

  // PayTR: total_amount is kuruş (integer cents string)
  describe('PayTR (kuruş)', () => {
    it('returns null when PayTR amount matches', () => {
      const payment = createMockPayment({ amount: '100.50' });
      const body = { total_amount: '10050' }; // 100.50 TRY = 10050 kuruş
      expect(service.checkAmountMismatch('paytr', body, payment)).toBeNull();
    });

    it('returns mismatch when PayTR amount differs', () => {
      const payment = createMockPayment({ amount: '100.50' });
      const body = { total_amount: '9999' };
      const result = service.checkAmountMismatch('paytr', body, payment);
      expect(result).toEqual({
        expected_amount: '10050',
        callback_amount: '9999',
      });
    });

    it('returns null when PayTR callback has no total_amount (skip check)', () => {
      const payment = createMockPayment({ amount: '100.50' });
      const body = {}; // No total_amount — provider may omit on failure
      expect(service.checkAmountMismatch('paytr', body, payment)).toBeNull();
    });

    it('returns mismatch when PayTR total_amount is NaN', () => {
      const payment = createMockPayment({ amount: '100.50' });
      const body = { total_amount: 'abc' };
      const result = service.checkAmountMismatch('paytr', body, payment);
      expect(result).not.toBeNull();
    });

    it('handles exact integer amounts (no decimals)', () => {
      const payment = createMockPayment({ amount: '200.00' });
      const body = { total_amount: '20000' };
      expect(service.checkAmountMismatch('paytr', body, payment)).toBeNull();
    });
  });

  // iyzico: paidPrice is decimal string (e.g. "100.50")
  describe('iyzico (decimal)', () => {
    it('returns null when iyzico amount matches', () => {
      const payment = createMockPayment({ amount: '100.50' });
      const body = { paidPrice: '100.50' };
      expect(service.checkAmountMismatch('iyzico', body, payment)).toBeNull();
    });

    it('returns mismatch when iyzico amount differs', () => {
      const payment = createMockPayment({ amount: '100.50' });
      const body = { paidPrice: '99.99' };
      const result = service.checkAmountMismatch('iyzico', body, payment);
      expect(result).toEqual({
        expected_amount: '10050',
        callback_amount: '9999',
      });
    });

    it('returns null when iyzico callback has no paidPrice (skip check)', () => {
      const payment = createMockPayment({ amount: '100.50' });
      const body = {};
      expect(service.checkAmountMismatch('iyzico', body, payment)).toBeNull();
    });

    it('handles rounding for floating point (e.g. 19.99)', () => {
      const payment = createMockPayment({ amount: '19.99' });
      const body = { paidPrice: '19.99' };
      expect(service.checkAmountMismatch('iyzico', body, payment)).toBeNull();
    });
  });

  // Unknown provider
  describe('unknown provider', () => {
    it('returns null (no amount field to check)', () => {
      const payment = createMockPayment({ amount: '100.50' });
      const body = { total_amount: '9999' }; // irrelevant for unknown
      expect(service.checkAmountMismatch('unknown', body, payment)).toBeNull();
    });
  });
});

// ─── Fix 1: iyzico callback token verification ─────────────

describe('PosCallbackService.processCallback — iyzico token verification', () => {
  it('throws BadRequestException when iyzico callback token is missing', async () => {
    const locked = createMockPayment({ posTransactionToken: 'tok-abc-123' });
    const qr = createMockQueryRunner(locked);
    const service = createService({ queryRunner: qr });

    await expect(
      service.processCallback('iyzico', {}, { paymentId: 'pay-001' }, '127.0.0.1'),
    ).rejects.toThrow(BadRequestException);

    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });

  it('throws BadRequestException when iyzico callback token does not match DB', async () => {
    const locked = createMockPayment({ posTransactionToken: 'tok-abc-123' });
    const qr = createMockQueryRunner(locked);
    const service = createService({ queryRunner: qr });

    await expect(
      service.processCallback(
        'iyzico',
        {},
        { paymentId: 'pay-001', token: 'wrong-token' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });

  it('proceeds when iyzico callback token matches DB posTransactionToken', async () => {
    const locked = createMockPayment({ posTransactionToken: 'tok-abc-123' });
    const qr = createMockQueryRunner(locked);
    const service = createService({ queryRunner: qr });

    // Should not throw — token matches
    await service.processCallback(
      'iyzico',
      {},
      { paymentId: 'pay-001', token: 'tok-abc-123' },
      '127.0.0.1',
    );

    expect(qr.commitTransaction).toHaveBeenCalled();
  });

  it('skips token check for non-iyzico providers', async () => {
    const locked = createMockPayment({ posTransactionToken: 'tok-abc-123' });
    const qr = createMockQueryRunner(locked);
    const service = createService({ queryRunner: qr });

    // PayTR callback with no token field — should proceed fine
    await service.processCallback(
      'paytr',
      {},
      { merchant_oid: 'pay-001', total_amount: '10050' },
      '127.0.0.1',
    );

    expect(qr.commitTransaction).toHaveBeenCalled();
  });
});

// ─── Fix 1+2 integration: amount mismatch blocks callback ──

describe('PosCallbackService.processCallback — amount cross-check', () => {
  it('throws BadRequestException when PayTR callback amount mismatches', async () => {
    const locked = createMockPayment({ amount: '100.50' });
    const qr = createMockQueryRunner(locked);
    const service = createService({ queryRunner: qr });

    await expect(
      service.processCallback(
        'paytr',
        {},
        { merchant_oid: 'pay-001', total_amount: '5000' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when iyzico callback amount mismatches', async () => {
    const locked = createMockPayment({ amount: '100.50', posTransactionToken: 'tok-abc-123' });
    const qr = createMockQueryRunner(locked);
    const service = createService({ queryRunner: qr });

    await expect(
      service.processCallback(
        'iyzico',
        {},
        { paymentId: 'pay-001', token: 'tok-abc-123', paidPrice: '50.00' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
