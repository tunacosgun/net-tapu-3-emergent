import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PricingService } from '../pricing.service';
import { Parcel } from '../../entities/parcel.entity';
import { PriceChangeLog } from '../../entities/price-change-log.entity';
import { PRICING_STRATEGY } from '../../pricing/pricing-strategy.interface';
import { BasePricingStrategy } from '../../pricing/base-pricing.strategy';

describe('PricingService', () => {
  let service: PricingService;

  const mockParcelUpdate = jest.fn();
  const mockLogSave = jest.fn();
  const mockLogCreate = jest.fn((obj: unknown) => obj);

  // Track parcels for the mock transaction
  const testParcels = [
    {
      id: 'p1',
      listingId: 'L001',
      price: '1000000.00',
      areaM2: '500.00',
      city: 'İstanbul',
      district: 'Kadıköy',
      landType: null,
      zoningStatus: null,
    },
    {
      id: 'p2',
      listingId: 'L002',
      price: '2000000.00',
      areaM2: '1000.00',
      city: 'İstanbul',
      district: 'Beşiktaş',
      landType: null,
      zoningStatus: null,
    },
    {
      id: 'p3',
      listingId: 'L003',
      price: null, // no price — should be skipped
      areaM2: null,
      city: 'Ankara',
      district: 'Çankaya',
      landType: null,
      zoningStatus: null,
    },
  ];

  // Mock transaction that executes callback with a mock manager
  const mockTransaction = jest.fn(async (cb: (manager: unknown) => Promise<unknown>) => {
    const mockManager = {
      getRepository: (entity: unknown) => {
        if (entity === Parcel) {
          return {
            createQueryBuilder: () => ({
              setLock: () => ({
                where: () => ({
                  getMany: jest.fn().mockResolvedValue(testParcels),
                }),
              }),
            }),
            update: mockParcelUpdate,
          };
        }
        if (entity === PriceChangeLog) {
          return {
            save: mockLogSave,
            create: mockLogCreate,
          };
        }
        return {};
      },
    };
    return cb(mockManager);
  });

  const mockDataSource = { transaction: mockTransaction };

  const mockParcelRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };

  const mockPriceChangeLogRepo = {
    save: jest.fn(),
    create: jest.fn((obj: unknown) => obj),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: getRepositoryToken(Parcel), useValue: mockParcelRepo },
        { provide: getRepositoryToken(PriceChangeLog), useValue: mockPriceChangeLogRepo },
        { provide: PRICING_STRATEGY, useClass: BasePricingStrategy },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe('applyToMany — bulk update', () => {
    it('should update parcels with price and skip parcels without price', async () => {
      const result = await service.applyToMany(
        ['p1', 'p2', 'p3'],
        { percent: 10 },
        'admin-user',
      );

      // p1 and p2 have prices, p3 does not
      expect(result.updated).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.changes).toHaveLength(2);

      // Verify p1: 1,000,000 * 1.10 = 1,100,000
      expect(result.changes[0].parcelId).toBe('p1');
      expect(result.changes[0].oldPrice).toBe(1_000_000);
      expect(result.changes[0].newPrice).toBe(1_100_000);
      expect(result.changes[0].changePercent).toBe(10);

      // Verify p2: 2,000,000 * 1.10 = 2,200,000
      expect(result.changes[1].parcelId).toBe('p2');
      expect(result.changes[1].newPrice).toBe(2_200_000);

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      // Verify DB updates happened
      expect(mockParcelUpdate).toHaveBeenCalledTimes(2);
      expect(mockLogSave).toHaveBeenCalledTimes(2);
    });

    it('should skip update when price is unchanged (idempotency)', async () => {
      // Override testParcels to have a price that won't change with 0%
      const unchangedParcels = [
        { ...testParcels[0] },
      ];

      mockTransaction.mockImplementationOnce(async (cb: (manager: unknown) => Promise<unknown>) => {
        const mgr = {
          getRepository: (entity: unknown) => {
            if (entity === Parcel) {
              return {
                createQueryBuilder: () => ({
                  setLock: () => ({
                    where: () => ({
                      getMany: jest.fn().mockResolvedValue(unchangedParcels),
                    }),
                  }),
                }),
                update: mockParcelUpdate,
              };
            }
            if (entity === PriceChangeLog) {
              return { save: mockLogSave, create: mockLogCreate };
            }
            return {};
          },
        };
        return cb(mgr);
      });

      const result = await service.applyToMany(
        ['p1'],
        { percent: 0 },
        'admin-user',
      );

      // 0% change → price unchanged → should be skipped
      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.changes).toHaveLength(0);

      // No DB writes should happen
      expect(mockParcelUpdate).not.toHaveBeenCalled();
      expect(mockLogSave).not.toHaveBeenCalled();
    });

    it('should use pessimistic_write lock for concurrency safety', async () => {
      const setLockMock = jest.fn().mockReturnValue({
        where: () => ({
          getMany: jest.fn().mockResolvedValue([testParcels[0]]),
        }),
      });

      mockTransaction.mockImplementationOnce(async (cb: (manager: unknown) => Promise<unknown>) => {
        const mgr = {
          getRepository: (entity: unknown) => {
            if (entity === Parcel) {
              return {
                createQueryBuilder: () => ({ setLock: setLockMock }),
                update: mockParcelUpdate,
              };
            }
            if (entity === PriceChangeLog) {
              return { save: mockLogSave, create: mockLogCreate };
            }
            return {};
          },
        };
        return cb(mgr);
      });

      await service.applyToMany(['p1'], { percent: 5 }, 'admin-user');

      // Verify pessimistic_write lock was requested
      expect(setLockMock).toHaveBeenCalledWith('pessimistic_write');
    });
  });

  describe('applyToParcel — single update', () => {
    it('should apply pricing and log change for a single parcel', async () => {
      mockParcelRepo.findOne.mockResolvedValueOnce(testParcels[0]);

      const result = await service.applyToParcel(
        'p1',
        { percent: 15 },
        'admin-user',
      );

      // 1,000,000 * 1.15 = 1,150,000
      expect(result.newPrice).toBe(1_150_000);
      expect(result.parcelId).toBe('p1');
      expect(result.appliedStrategy).toBe('base_percentage');

      expect(mockParcelRepo.update).toHaveBeenCalledWith('p1', { price: '1150000.00' });
      expect(mockPriceChangeLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should throw for non-existent parcel', async () => {
      mockParcelRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.applyToParcel('nonexistent', { percent: 10 }, 'admin-user'),
      ).rejects.toThrow('Parcel nonexistent not found or has no price');
    });
  });

  describe('getHistory', () => {
    it('should return price change history ordered by createdAt DESC', async () => {
      const logs = [
        { id: 'log1', parcelId: 'p1', createdAt: new Date() },
        { id: 'log2', parcelId: 'p1', createdAt: new Date() },
      ];
      mockPriceChangeLogRepo.find.mockResolvedValueOnce(logs);

      const result = await service.getHistory('p1', 10);

      expect(result).toHaveLength(2);
      expect(mockPriceChangeLogRepo.find).toHaveBeenCalledWith({
        where: { parcelId: 'p1' },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });
});
