import { DepositLifecycleService } from './deposit-lifecycle.service';
import { CircuitOpenError, IPaymentService } from './payment.service';
import { SettlementManifestItem } from './settlement.service';
import { Deposit } from '@nettapu/shared';
import { SettlementManifest } from '../entities/settlement-manifest.entity';

// ── Helpers ─────────────────────────────────────────────────────

function makeDeposit(overrides: Partial<Deposit> = {}): Deposit {
  return {
    id: 'dep-1',
    userId: 'user-1',
    auctionId: 'auction-1',
    amount: '1000.00',
    currency: 'TRY',
    status: 'held',
    paymentMethod: 'credit_card',
    posProvider: 'paytr',
    posTransactionId: 'pos-tx-1',
    idempotencyKey: 'dep-key-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Deposit;
}

function makeItem(overrides: Partial<SettlementManifestItem> = {}): SettlementManifestItem {
  return {
    item_id: 'item-1',
    deposit_id: 'dep-1',
    user_id: 'user-1',
    action: 'capture',
    amount: '1000.00',
    currency: 'TRY',
    status: 'pending',
    idempotency_key: 'settlement:auction-1:dep-1:capture',
    pos_reference: null,
    sent_at: null,
    acknowledged_at: null,
    failure_reason: null,
    retry_count: 0,
    ...overrides,
  };
}

function makeManifest(): SettlementManifest {
  return { id: 'manifest-1', auctionId: 'auction-1' } as SettlementManifest;
}

// ── Mock factories ──────────────────────────────────────────────

function createMockQueryRunner(lockedDeposit: Deposit | null = null) {
  const qr = {
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
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
        getOne: jest.fn().mockResolvedValue(lockedDeposit),
      }),
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((_entity: unknown, data: unknown) => data),
    },
  };
  return qr;
}

function createMockDataSource(qr: ReturnType<typeof createMockQueryRunner>) {
  return { createQueryRunner: jest.fn().mockReturnValue(qr) };
}

function createMockPaymentService(): jest.Mocked<IPaymentService> {
  return {
    captureDeposit: jest.fn(),
    refundDeposit: jest.fn(),
  };
}

function createMockMetrics() {
  return {
    settlementItemFailuresTotal: { inc: jest.fn() },
  };
}

function createService(overrides: {
  depositRepo?: { findOne: jest.Mock };
  dataSource?: ReturnType<typeof createMockDataSource>;
  paymentService?: jest.Mocked<IPaymentService>;
  metrics?: ReturnType<typeof createMockMetrics>;
} = {}) {
  const depositRepo = overrides.depositRepo ?? { findOne: jest.fn() };
  const qr = createMockQueryRunner(makeDeposit());
  const dataSource = overrides.dataSource ?? createMockDataSource(qr);
  const paymentService = overrides.paymentService ?? createMockPaymentService();
  const metrics = overrides.metrics ?? createMockMetrics();

  const service = new DepositLifecycleService(
    depositRepo as any,
    dataSource as any,
    paymentService,
    metrics as any,
  );

  return { service, depositRepo, dataSource, paymentService, metrics };
}

// ── Tests ───────────────────────────────────────────────────────

describe('DepositLifecycleService', () => {
  // 1. Capture happy path
  describe('processCaptureItem', () => {
    it('should capture a held deposit and return acknowledged', async () => {
      const deposit = makeDeposit({ status: 'held' });
      const item = makeItem({ action: 'capture' });
      const manifest = makeManifest();

      const qr = createMockQueryRunner(deposit);
      const dataSource = createMockDataSource(qr);
      const paymentService = createMockPaymentService();
      paymentService.captureDeposit.mockResolvedValue({
        success: true,
        posReference: 'pos-ref-123',
        message: 'OK',
      });

      const { service } = createService({
        depositRepo: { findOne: jest.fn().mockResolvedValue(deposit) },
        dataSource,
        paymentService,
      });

      const result = await service.processCaptureItem(manifest, item);

      expect(result.status).toBe('acknowledged');
      expect(result.pos_reference).toBe('pos-ref-123');
      expect(result.acknowledged_at).toBeTruthy();
      expect(paymentService.captureDeposit).toHaveBeenCalledTimes(1);
    });

    // 2. Capture idempotent
    it('should return acknowledged without POS call for already-captured deposit', async () => {
      const deposit = makeDeposit({ status: 'captured' });
      const item = makeItem({ action: 'capture' });
      const manifest = makeManifest();

      const paymentService = createMockPaymentService();
      const { service } = createService({
        depositRepo: { findOne: jest.fn().mockResolvedValue(deposit) },
        paymentService,
      });

      const result = await service.processCaptureItem(manifest, item);

      expect(result.status).toBe('acknowledged');
      expect(paymentService.captureDeposit).not.toHaveBeenCalled();
    });

    // 3. Capture POS failure
    it('should return failed with retry_count++ when POS returns failure', async () => {
      const deposit = makeDeposit({ status: 'held' });
      const item = makeItem({ action: 'capture', retry_count: 0 });
      const manifest = makeManifest();

      const paymentService = createMockPaymentService();
      paymentService.captureDeposit.mockResolvedValue({
        success: false,
        posReference: null,
        message: 'POS declined',
      });

      const { service } = createService({
        depositRepo: { findOne: jest.fn().mockResolvedValue(deposit) },
        paymentService,
      });

      const result = await service.processCaptureItem(manifest, item);

      expect(result.status).toBe('failed');
      expect(result.failure_reason).toBe('POS declined');
      expect(result.retry_count).toBe(1);
    });

    // 4. Capture circuit open
    it('should return failed when CircuitOpenError is thrown', async () => {
      const deposit = makeDeposit({ status: 'held' });
      const item = makeItem({ action: 'capture', retry_count: 0 });
      const manifest = makeManifest();

      const paymentService = createMockPaymentService();
      paymentService.captureDeposit.mockRejectedValue(new CircuitOpenError());

      const { service } = createService({
        depositRepo: { findOne: jest.fn().mockResolvedValue(deposit) },
        paymentService,
      });

      const result = await service.processCaptureItem(manifest, item);

      expect(result.status).toBe('failed');
      expect(result.failure_reason).toContain('circuit breaker');
      expect(result.retry_count).toBe(1);
    });

    // 8. Capture crash recovery — POS throws, re-read shows captured
    it('should recover as acknowledged when POS throws but deposit is already captured', async () => {
      const deposit = makeDeposit({ status: 'held' });
      const item = makeItem({ action: 'capture' });
      const manifest = makeManifest();

      const paymentService = createMockPaymentService();
      paymentService.captureDeposit.mockRejectedValue(new Error('network error'));

      // First call returns held deposit, second call (recheck) returns captured
      const depositRepo = {
        findOne: jest.fn()
          .mockResolvedValueOnce(deposit)
          .mockResolvedValueOnce(makeDeposit({ status: 'captured' })),
      };

      const { service } = createService({ depositRepo, paymentService });

      const result = await service.processCaptureItem(manifest, item);

      expect(result.status).toBe('acknowledged');
      expect(result.acknowledged_at).toBeTruthy();
    });
  });

  // 5. Refund happy path
  describe('processRefundItem', () => {
    it('should refund a held deposit and return acknowledged', async () => {
      const deposit = makeDeposit({ status: 'held' });
      const item = makeItem({ action: 'refund', idempotency_key: 'settlement:auction-1:dep-1:refund' });
      const manifest = makeManifest();

      const qr = createMockQueryRunner(deposit);
      const dataSource = createMockDataSource(qr);
      const paymentService = createMockPaymentService();
      paymentService.refundDeposit.mockResolvedValue({
        success: true,
        posRefundId: 'refund-ref-123',
        message: 'OK',
      });

      const { service } = createService({
        depositRepo: { findOne: jest.fn().mockResolvedValue(deposit) },
        dataSource,
        paymentService,
      });

      const result = await service.processRefundItem(manifest, item);

      expect(result.status).toBe('acknowledged');
      expect(result.pos_reference).toBe('refund-ref-123');
      expect(paymentService.refundDeposit).toHaveBeenCalledTimes(1);
    });

    // 6. Refund idempotent
    it('should return acknowledged without POS call for already-refunded deposit', async () => {
      const deposit = makeDeposit({ status: 'refunded' });
      const item = makeItem({ action: 'refund', idempotency_key: 'settlement:auction-1:dep-1:refund' });
      const manifest = makeManifest();

      const paymentService = createMockPaymentService();
      const { service } = createService({
        depositRepo: { findOne: jest.fn().mockResolvedValue(deposit) },
        paymentService,
      });

      const result = await service.processRefundItem(manifest, item);

      expect(result.status).toBe('acknowledged');
      expect(paymentService.refundDeposit).not.toHaveBeenCalled();
    });

    // 7. Refund crash recovery — refund_pending → skips initiation, calls POS
    it('should skip initiation and call POS directly for refund_pending deposit', async () => {
      const deposit = makeDeposit({ status: 'refund_pending' });
      const item = makeItem({ action: 'refund', idempotency_key: 'settlement:auction-1:dep-1:refund' });
      const manifest = makeManifest();

      const qr = createMockQueryRunner(makeDeposit({ status: 'refund_pending' }));
      const dataSource = createMockDataSource(qr);
      const paymentService = createMockPaymentService();
      paymentService.refundDeposit.mockResolvedValue({
        success: true,
        posRefundId: 'refund-ref-456',
        message: 'OK',
      });

      const { service } = createService({
        depositRepo: { findOne: jest.fn().mockResolvedValue(deposit) },
        dataSource,
        paymentService,
      });

      const result = await service.processRefundItem(manifest, item);

      expect(result.status).toBe('acknowledged');
      expect(result.pos_reference).toBe('refund-ref-456');
      expect(paymentService.refundDeposit).toHaveBeenCalledTimes(1);
    });
  });
});
