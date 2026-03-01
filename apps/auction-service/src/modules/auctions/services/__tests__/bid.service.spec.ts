import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { BidService } from '../bid.service';
import { Auction } from '../../entities/auction.entity';
import { Bid } from '../../entities/bid.entity';
import { BidRejection } from '../../entities/bid-rejection.entity';
import { AuctionParticipant } from '../../entities/auction-participant.entity';
import { AuctionConsent } from '../../entities/auction-consent.entity';
import { RedisLockService } from '../redis-lock.service';
import { OutboxWriterService } from '../outbox-writer.service';
import { MetricsService } from '../../../../metrics/metrics.service';
import { AuctionStatus, Deposit, DepositStatus } from '@nettapu/shared';

/**
 * Concurrency simulation tests for BidService.
 *
 * These tests verify:
 * 1. SELECT FOR UPDATE prevents concurrent modification
 * 2. Only one bid wins per round when 10 simultaneous bids arrive
 * 3. Late bids at auction end boundary are rejected (DB time check)
 * 4. Deposit validation in the bid transaction
 * 5. Idempotency guard prevents double bids
 */

// ── Test fixtures ──────────────────────────────────────────────

function createMockAuction(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'auction-1',
    parcelId: 'parcel-1',
    title: 'Test Auction',
    status: AuctionStatus.LIVE,
    startingPrice: '100000.00',
    minimumIncrement: '1000.00',
    currentPrice: '105000.00',
    requiredDeposit: '10000.00',
    scheduledEnd: new Date(Date.now() + 3600_000).toISOString(), // 1 hour from now
    extendedUntil: null,
    extensionCount: 0,
    bidCount: 5,
    version: 1,
    ...overrides,
  };
}

function createMockParticipant(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'participant-1',
    auctionId: 'auction-1',
    userId: 'user-1',
    depositId: 'deposit-1',
    eligible: true,
    ...overrides,
  };
}

function createMockDeposit(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'deposit-1',
    userId: 'user-1',
    auctionId: 'auction-1',
    amount: '10000.00',
    status: DepositStatus.HELD,
    ...overrides,
  };
}

function createMockConsent(): Record<string, unknown> {
  return {
    id: 'consent-1',
    auctionId: 'auction-1',
    userId: 'user-1',
    consentTextHash: 'abc123',
    acceptedAt: new Date(),
  };
}

// ── Mock infrastructure ────────────────────────────────────────

describe('BidService — Concurrency', () => {
  let service: BidService;

  // Track lock state for simulating concurrent access
  let lockAcquired: boolean;
  let savedBids: Record<string, unknown>[];
  let savedAuctionState: Record<string, unknown> | null;

  const mockRedisLock = {
    acquire: jest.fn(),
    release: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const config: Record<string, unknown> = {
        SNIPER_EXTENSION_SECONDS: 60,
        MAX_SNIPER_EXTENSIONS: 5,
      };
      return config[key];
    }),
  };

  // The mock QueryRunner simulates a real DB transaction
  let mockQueryRunner: Record<string, unknown>;
  let mockManagerFindOne: jest.Mock;
  let mockManagerSave: jest.Mock;
  let mockManagerCreate: jest.Mock;
  let mockManagerCreateQueryBuilder: jest.Mock;
  let mockQuery: jest.Mock;

  function setupQueryRunner(auctionData: Record<string, unknown> | null, opts: {
    participant?: Record<string, unknown> | null;
    deposit?: Record<string, unknown> | null;
    consent?: Record<string, unknown> | null;
    existingBid?: Record<string, unknown> | null;
    dupBid?: Record<string, unknown> | null;
    dbTimeIsPastEnd?: boolean;
    remainingMs?: number;
  } = {}) {
    const participant = opts.participant === undefined ? createMockParticipant() : opts.participant;
    const deposit = opts.deposit === undefined ? createMockDeposit() : opts.deposit;
    const consent = opts.consent === undefined ? createMockConsent() : opts.consent;

    mockManagerFindOne = jest.fn((entity: unknown, options: Record<string, unknown>) => {
      const where = options?.where as Record<string, unknown>;
      const entityName = typeof entity === 'function' ? (entity as { name: string }).name : '';
      // Phase 3: idempotency re-check
      if (entityName === 'Bid' && where?.idempotencyKey) {
        return Promise.resolve(opts.existingBid ?? null);
      }
      // Phase 6: participant
      if (entityName === 'AuctionParticipant') {
        return Promise.resolve(participant);
      }
      // Phase 6b: deposit
      if (entityName === 'Deposit') {
        return Promise.resolve(deposit);
      }
      // Phase 7: consent
      if (entityName === 'AuctionConsent') {
        return Promise.resolve(consent);
      }
      // Phase 10: duplicate amount check
      if (entityName === 'Bid' && where?.amount) {
        return Promise.resolve(opts.dupBid ?? null);
      }
      return Promise.resolve(null);
    });

    mockManagerSave = jest.fn((entity: unknown, data: Record<string, unknown>) => {
      if (entity === Bid) {
        const saved = { ...data, id: `bid-${Date.now()}`, serverTs: new Date() };
        savedBids.push(saved);
        return Promise.resolve(saved);
      }
      if (entity === Auction) {
        savedAuctionState = { ...data };
        return Promise.resolve(data);
      }
      if (entity === BidRejection) {
        return Promise.resolve(data);
      }
      return Promise.resolve(data);
    });

    mockManagerCreate = jest.fn((_entity: unknown, data: Record<string, unknown>) => ({
      ...data,
      serverTs: data.serverTs ?? new Date(),
    }));

    // createQueryBuilder for SELECT FOR UPDATE (Phase 4)
    mockManagerCreateQueryBuilder = jest.fn(() => ({
      setLock: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          getOne: jest.fn().mockResolvedValue(auctionData),
        }),
      }),
    }));

    // Raw queries (Phase 5b: DB time check, Phase 12: sniper calc)
    mockQuery = jest.fn((sql: string) => {
      if (sql.includes('is_past_end')) {
        return Promise.resolve([{
          db_now: new Date().toISOString(),
          is_past_end: opts.dbTimeIsPastEnd ?? false,
        }]);
      }
      if (sql.includes('remaining_ms')) {
        return Promise.resolve([{
          remaining_ms: String(opts.remainingMs ?? 3600_000),
        }]);
      }
      if (sql.includes('new_end')) {
        return Promise.resolve([{
          new_end: new Date(Date.now() + 60_000).toISOString(),
        }]);
      }
      return Promise.resolve([]);
    });

    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: false,
      query: mockQuery,
      manager: {
        findOne: mockManagerFindOne,
        save: mockManagerSave,
        create: mockManagerCreate,
        createQueryBuilder: mockManagerCreateQueryBuilder,
      },
    };
  }

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockBidRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    lockAcquired = true;
    savedBids = [];
    savedAuctionState = null;

    mockRedisLock.acquire.mockResolvedValue('lock-value-1');
    mockRedisLock.release.mockResolvedValue(true);
    mockBidRepo.findOne.mockResolvedValue(null); // Phase 0: no existing bid

    setupQueryRunner(createMockAuction());
    // Ensure createQueryRunner always returns current mockQueryRunner
    mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidService,
        { provide: getRepositoryToken(Auction), useValue: {} },
        { provide: getRepositoryToken(Bid), useValue: mockBidRepo },
        { provide: getRepositoryToken(BidRejection), useValue: {} },
        { provide: getRepositoryToken(AuctionParticipant), useValue: {} },
        { provide: getRepositoryToken(AuctionConsent), useValue: {} },
        { provide: DataSource, useValue: mockDataSource },
        { provide: RedisLockService, useValue: mockRedisLock },
        { provide: ConfigService, useValue: mockConfig },
        { provide: OutboxWriterService, useValue: { write: jest.fn().mockResolvedValue(undefined), writeMany: jest.fn().mockResolvedValue(undefined) } },
        { provide: MetricsService, useValue: null },
      ],
    }).compile();

    service = module.get<BidService>(BidService);
  });

  // ── TEST 1: Successful bid placement ───────────────────────

  it('should accept a valid bid with all checks passing', async () => {
    const result = await service.placeBid(
      {
        auctionId: 'auction-1',
        amount: '106000.00',
        referencePrice: '105000.00',
        idempotencyKey: 'idem-1',
      },
      'user-1',
      '192.168.1.1',
    );

    expect(result.auction_id).toBe('auction-1');
    expect(result.amount).toBe('106000.00');
    expect(result.new_price).toBe('106000.00');
    expect(result.sniper_extended).toBe(false);

    // Verify FOR UPDATE was used
    expect(mockManagerCreateQueryBuilder).toHaveBeenCalledWith(Auction, 'a');

    // Verify transaction lifecycle
    expect(mockQueryRunner.connect).toHaveBeenCalled();
    expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

    // Verify lock lifecycle
    expect(mockRedisLock.acquire).toHaveBeenCalled();
    expect(mockRedisLock.release).toHaveBeenCalled();
  });

  // ── TEST 2: 10 simultaneous bids — lock contention ─────────

  describe('10 simultaneous bids', () => {
    it('should reject all but one via Redis lock contention', async () => {
      // First call acquires lock, subsequent calls fail
      let lockCount = 0;
      mockRedisLock.acquire.mockImplementation(async () => {
        lockCount++;
        if (lockCount === 1) return 'lock-value-1';
        return null; // Lock contention — rejected
      });

      const bidPromises = Array.from({ length: 10 }, (_, i) =>
        service.placeBid(
          {
            auctionId: 'auction-1',
            amount: `${106000 + (i + 1) * 1000}.00`,
            referencePrice: '105000.00',
            idempotencyKey: `idem-concurrent-${i}`,
          },
          `user-${i + 1}`,
          `192.168.1.${i + 1}`,
        ).catch((err) => err),
      );

      const results = await Promise.all(bidPromises);

      // Count successes vs lock contention errors
      const successes = results.filter(
        (r) => !(r instanceof Error) && !(r instanceof HttpException),
      );
      const lockErrors = results.filter(
        (r) => r instanceof HttpException && r.getStatus() === HttpStatus.SERVICE_UNAVAILABLE,
      );

      // Exactly 1 succeeds, 9 get lock contention
      expect(successes).toHaveLength(1);
      expect(lockErrors).toHaveLength(9);
    });

    it('should serialize bids when lock is eventually acquired', async () => {
      // Simulate all 10 acquiring the lock sequentially
      // (Redis lock released after each bid)
      let bidCount = 0;
      mockRedisLock.acquire.mockResolvedValue('lock-value-sequential');

      // Each bid sees a different current price (previous bid updated it)
      const expectedPrices = [
        '105000.00', '106000.00', '107000.00', '108000.00', '109000.00',
        '110000.00', '111000.00', '112000.00', '113000.00', '114000.00',
      ];

      for (let i = 0; i < 10; i++) {
        // Update auction mock for each successive bid
        const auctionPrice = expectedPrices[i];
        const newPrice = `${parseFloat(auctionPrice) + 1000}.00`;

        setupQueryRunner(createMockAuction({ currentPrice: auctionPrice, bidCount: 5 + i }));
        mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);
        mockBidRepo.findOne.mockResolvedValue(null);

        const result = await service.placeBid(
          {
            auctionId: 'auction-1',
            amount: newPrice,
            referencePrice: auctionPrice,
            idempotencyKey: `idem-serial-${i}`,
          },
          `user-${i + 1}`,
        );

        expect(result.amount).toBe(newPrice);
        bidCount++;
      }

      // All 10 processed sequentially
      expect(bidCount).toBe(10);
    });
  });

  // ── TEST 3: Late bid at auction end boundary ──────────────

  describe('late bid at auction end boundary', () => {
    it('should reject bid when DB time is past effective end', async () => {
      // Auction ends in the past according to DB time
      setupQueryRunner(
        createMockAuction({
          scheduledEnd: new Date(Date.now() - 1000).toISOString(), // 1s in the past
        }),
        { dbTimeIsPastEnd: true },
      );
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      await expect(
        service.placeBid(
          {
            auctionId: 'auction-1',
            amount: '106000.00',
            referencePrice: '105000.00',
            idempotencyKey: 'idem-late-1',
          },
          'user-1',
        ),
      ).rejects.toThrow(HttpException);

      try {
        await service.placeBid(
          {
            auctionId: 'auction-1',
            amount: '106000.00',
            referencePrice: '105000.00',
            idempotencyKey: 'idem-late-2',
          },
          'user-1',
        );
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        const body = httpErr.getResponse() as Record<string, unknown>;
        expect(body.reason_code).toBe('auction_not_live');
        expect(body.message).toBe('Auction has ended');
      }
    });

    it('should accept bid when DB time is just before effective end', async () => {
      setupQueryRunner(
        createMockAuction({
          scheduledEnd: new Date(Date.now() + 30_000).toISOString(), // 30s from now
        }),
        { dbTimeIsPastEnd: false, remainingMs: 30_000 },
      );
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      const result = await service.placeBid(
        {
          auctionId: 'auction-1',
          amount: '106000.00',
          referencePrice: '105000.00',
          idempotencyKey: 'idem-just-in-time',
        },
        'user-1',
      );

      expect(result.amount).toBe('106000.00');
      // 30s remaining < 60s sniper window → should trigger extension
      expect(result.sniper_extended).toBe(true);
      expect(result.extended_until).toBeDefined();
    });
  });

  // ── TEST 4: Deposit validation in transaction ──────────────

  describe('deposit validation', () => {
    it('should reject bid when deposit is not found', async () => {
      setupQueryRunner(createMockAuction(), { deposit: null });
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      await expect(
        service.placeBid(
          {
            auctionId: 'auction-1',
            amount: '106000.00',
            referencePrice: '105000.00',
            idempotencyKey: 'idem-no-deposit',
          },
          'user-1',
        ),
      ).rejects.toThrow('No valid deposit found');
    });

    it('should reject bid when deposit status is refunded', async () => {
      setupQueryRunner(createMockAuction(), {
        deposit: createMockDeposit({ status: DepositStatus.REFUNDED }),
      });
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      await expect(
        service.placeBid(
          {
            auctionId: 'auction-1',
            amount: '106000.00',
            referencePrice: '105000.00',
            idempotencyKey: 'idem-refunded-deposit',
          },
          'user-1',
        ),
      ).rejects.toThrow('Deposit is not in a valid state');
    });

    it('should reject bid when deposit amount is insufficient', async () => {
      setupQueryRunner(
        createMockAuction({ requiredDeposit: '50000.00' }),
        { deposit: createMockDeposit({ amount: '10000.00' }) },
      );
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      await expect(
        service.placeBid(
          {
            auctionId: 'auction-1',
            amount: '106000.00',
            referencePrice: '105000.00',
            idempotencyKey: 'idem-low-deposit',
          },
          'user-1',
        ),
      ).rejects.toThrow('Deposit amount insufficient');
    });

    it('should accept bid when deposit is in COLLECTED status', async () => {
      setupQueryRunner(createMockAuction(), {
        deposit: createMockDeposit({ status: DepositStatus.COLLECTED }),
      });
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      const result = await service.placeBid(
        {
          auctionId: 'auction-1',
          amount: '106000.00',
          referencePrice: '105000.00',
          idempotencyKey: 'idem-collected-deposit',
        },
        'user-1',
      );

      expect(result.amount).toBe('106000.00');
    });
  });

  // ── TEST 5: Idempotency guard ──────────────────────────────

  describe('idempotency', () => {
    it('should return cached response on Phase 0 idempotency hit', async () => {
      const existingBid = {
        id: 'bid-existing',
        auctionId: 'auction-1',
        amount: '106000.00',
        serverTs: new Date(),
        idempotencyKey: 'idem-dup',
      };
      mockBidRepo.findOne.mockResolvedValue(existingBid);

      const result = await service.placeBid(
        {
          auctionId: 'auction-1',
          amount: '106000.00',
          referencePrice: '105000.00',
          idempotencyKey: 'idem-dup',
        },
        'user-1',
      );

      // Should NOT acquire lock (fast-path return)
      expect(mockRedisLock.acquire).not.toHaveBeenCalled();
      expect(result.bid_id).toBe('bid-existing');
    });

    it('should return cached response on Phase 3 in-transaction idempotency hit', async () => {
      // Phase 0 misses, but Phase 3 (inside transaction) finds it
      const existingBid = {
        id: 'bid-race-winner',
        auctionId: 'auction-1',
        amount: '106000.00',
        serverTs: new Date(),
        idempotencyKey: 'idem-race',
      };
      mockBidRepo.findOne.mockResolvedValue(null); // Phase 0: miss
      setupQueryRunner(createMockAuction(), { existingBid });
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      const result = await service.placeBid(
        {
          auctionId: 'auction-1',
          amount: '106000.00',
          referencePrice: '105000.00',
          idempotencyKey: 'idem-race',
        },
        'user-1',
      );

      expect(result.bid_id).toBe('bid-race-winner');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ── TEST 6: Minimum increment enforcement ──────────────────

  describe('minimum increment', () => {
    it('should reject bid below minimum increment', async () => {
      // Current price: 105000, min increment: 1000, minimum bid: 106000
      await expect(
        service.placeBid(
          {
            auctionId: 'auction-1',
            amount: '105500.00', // Below 106000
            referencePrice: '105000.00',
            idempotencyKey: 'idem-below-min',
          },
          'user-1',
        ),
      ).rejects.toThrow('Minimum bid is');
    });
  });

  // ── TEST 7: Sniper protection ──────────────────────────────

  describe('sniper protection', () => {
    it('should extend auction when bid is within sniper window', async () => {
      setupQueryRunner(
        createMockAuction({
          scheduledEnd: new Date(Date.now() + 30_000).toISOString(),
          extensionCount: 0,
        }),
        { dbTimeIsPastEnd: false, remainingMs: 30_000 },
      );
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      const result = await service.placeBid(
        {
          auctionId: 'auction-1',
          amount: '106000.00',
          referencePrice: '105000.00',
          idempotencyKey: 'idem-sniper-1',
        },
        'user-1',
      );

      expect(result.sniper_extended).toBe(true);
      expect(result.extended_until).toBeDefined();
    });

    it('should NOT extend when max extensions reached', async () => {
      setupQueryRunner(
        createMockAuction({
          scheduledEnd: new Date(Date.now() + 30_000).toISOString(),
          extensionCount: 5, // MAX reached
        }),
        { dbTimeIsPastEnd: false, remainingMs: 30_000 },
      );
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      const result = await service.placeBid(
        {
          auctionId: 'auction-1',
          amount: '106000.00',
          referencePrice: '105000.00',
          idempotencyKey: 'idem-sniper-max',
        },
        'user-1',
      );

      expect(result.sniper_extended).toBe(false);
    });

    it('should NOT extend when bid is outside sniper window', async () => {
      setupQueryRunner(
        createMockAuction({
          scheduledEnd: new Date(Date.now() + 3600_000).toISOString(), // 1hr
        }),
        { dbTimeIsPastEnd: false, remainingMs: 3600_000 },
      );
      mockDataSource.createQueryRunner.mockImplementation(() => mockQueryRunner);

      const result = await service.placeBid(
        {
          auctionId: 'auction-1',
          amount: '106000.00',
          referencePrice: '105000.00',
          idempotencyKey: 'idem-sniper-far',
        },
        'user-1',
      );

      expect(result.sniper_extended).toBe(false);
    });
  });

  // ── TEST 8: Reference price stale check ────────────────────

  describe('reference price check', () => {
    it('should reject bid with stale reference price', async () => {
      await expect(
        service.placeBid(
          {
            auctionId: 'auction-1',
            amount: '106000.00',
            referencePrice: '100000.00', // Stale — actual is 105000
            idempotencyKey: 'idem-stale-ref',
          },
          'user-1',
        ),
      ).rejects.toThrow('Price changed');
    });
  });
});
