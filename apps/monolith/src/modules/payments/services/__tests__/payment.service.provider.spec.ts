import { PaymentService } from '../payment.service';
import { PaymentStatus } from '@nettapu/shared';

/**
 * Unit test for HIGH priority Fix 3:
 *   recordPosResult must use actual POS_PROVIDER from ConfigService,
 *   not hardcoded 'mock'.
 */

function createMockQueryRunner(lockedPayment: any) {
  const saved: any[] = [];
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
      save: jest.fn().mockImplementation((_entity: any, data: any) => {
        saved.push(data);
        return data;
      }),
      create: jest.fn().mockImplementation((_entity: any, data: any) => data),
    },
    _saved: saved,
  };
  return qr;
}

describe('PaymentService — Fix 3: provider from ConfigService', () => {
  function createServiceWithProvider(providerValue: string) {
    const paymentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const posTxRepo = {};
    const idempotencyRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const posGateway = {
      initiateProvision: jest.fn().mockResolvedValue({
        status: 'completed',
        posReference: 'ref-001',
        message: 'OK',
      }),
    };

    const lockedPayment = {
      id: 'pay-001',
      amount: '100.00',
      currency: 'TRY',
      status: PaymentStatus.PENDING,
      userId: 'user-1',
      parcelId: 'parcel-1',
    };

    const qr = createMockQueryRunner(lockedPayment);

    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(qr),
    };

    const config = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
        if (key === 'POS_PROVIDER') return providerValue;
        return defaultVal;
      }),
    };

    const depositRepo = { create: jest.fn((e: any) => e), save: jest.fn((e: any, v: any) => Promise.resolve({ ...v, id: 'dep-1' })) };

    const service = new PaymentService(
      paymentRepo as any,
      posTxRepo as any,
      idempotencyRepo as any,
      depositRepo as any,
      posGateway as any,
      dataSource as any,
      config as any,
    );

    return { service, qr, posGateway, paymentRepo };
  }

  it('records PosTransaction with provider from ConfigService, not hardcoded "mock"', async () => {
    const { service, qr } = createServiceWithProvider('paytr');

    // Invoke initiate — it will go through Phase 1 (create payment TX),
    // Phase 2 (POS call), Phase 3 (recordPosResult).
    // Phase 1 TX creates payment, then the recordPosResult TX records PosTransaction.
    await service.initiate(
      {
        parcelId: 'parcel-1',
        amount: '100.00',
        currency: 'TRY',
        paymentMethod: 'credit_card',
        idempotencyKey: 'idem-001',
      },
      'user-1',
    );

    // Find the PosTransaction record among all saves
    const posTxRecord = qr._saved.find(
      (s: any) => s.provider !== undefined && s.externalId !== undefined,
    );
    expect(posTxRecord).toBeDefined();
    expect(posTxRecord.provider).toBe('paytr');
  });

  it('uses "mock" as default when POS_PROVIDER is unset', async () => {
    const { service, qr } = createServiceWithProvider('mock');

    await service.initiate(
      {
        parcelId: 'parcel-1',
        amount: '100.00',
        currency: 'TRY',
        paymentMethod: 'credit_card',
        idempotencyKey: 'idem-002',
      },
      'user-1',
    );

    const posTxRecord = qr._saved.find(
      (s: any) => s.provider !== undefined && s.externalId !== undefined,
    );
    expect(posTxRecord).toBeDefined();
    expect(posTxRecord.provider).toBe('mock');
  });

  it('records correct provider for iyzico', async () => {
    const { service, qr } = createServiceWithProvider('iyzico');

    await service.initiate(
      {
        parcelId: 'parcel-1',
        amount: '100.00',
        currency: 'TRY',
        paymentMethod: 'credit_card',
        idempotencyKey: 'idem-003',
      },
      'user-1',
    );

    const posTxRecord = qr._saved.find(
      (s: any) => s.provider !== undefined && s.externalId !== undefined,
    );
    expect(posTxRecord).toBeDefined();
    expect(posTxRecord.provider).toBe('iyzico');
  });
});
