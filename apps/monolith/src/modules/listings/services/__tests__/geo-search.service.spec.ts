import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GeoSearchService } from '../geo-search.service';
import { Parcel } from '../../entities/parcel.entity';

describe('GeoSearchService', () => {
  let service: GeoSearchService;

  const mockQuery = jest.fn();

  const mockParcelRepo = {
    query: mockQuery,
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoSearchService,
        { provide: getRepositoryToken(Parcel), useValue: mockParcelRepo },
      ],
    }).compile();

    service = module.get<GeoSearchService>(GeoSearchService);
  });

  describe('findWithinRadius', () => {
    it('should call query with correct ST_DWithin parameters', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '3' }])   // count
        .mockResolvedValueOnce([                      // data
          { id: 'p1', distanceMeters: '1200.5' },
          { id: 'p2', distanceMeters: '3400.2' },
        ]);

      const result = await service.findWithinRadius(39.9, 32.8, 5000);

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].distanceMeters).toBe(1200.5);

      // Verify SQL contains ST_DWithin
      expect(mockQuery.mock.calls[0][0]).toContain('ST_DWithin');
      // Parameters: [lng, lat, radius, status]
      expect(mockQuery.mock.calls[0][1]).toEqual([32.8, 39.9, 5000, 'active']);
    });

    it('should pass custom status filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([]);

      await service.findWithinRadius(39.9, 32.8, 5000, { status: 'draft' });

      expect(mockQuery.mock.calls[0][1]).toContain('draft');
    });

    it('should pass limit and offset', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '100' }])
        .mockResolvedValueOnce([]);

      await service.findWithinRadius(39.9, 32.8, 5000, {
        limit: 20,
        offset: 40,
      });

      // Data query params: [lng, lat, radius, status, limit, offset]
      const dataParams = mockQuery.mock.calls[1][1];
      expect(dataParams).toContain(20);
      expect(dataParams).toContain(40);
    });
  });

  describe('findInBoundingBox', () => {
    it('should call query with ST_MakeEnvelope', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '5' }])
        .mockResolvedValueOnce([{ id: 'p1' }]);

      const result = await service.findInBoundingBox(39, 32, 40, 33);

      expect(result.total).toBe(5);
      expect(mockQuery.mock.calls[0][0]).toContain('ST_MakeEnvelope');
      // Parameters: [minLng, minLat, maxLng, maxLat, status]
      expect(mockQuery.mock.calls[0][1]).toEqual([32, 39, 33, 40, 'active']);
    });
  });

  describe('findNearest', () => {
    it('should call query with KNN ordering', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'p1', distanceMeters: '500' },
        { id: 'p2', distanceMeters: '1200' },
      ]);

      const result = await service.findNearest(39.9, 32.8, 10);

      expect(result).toHaveLength(2);
      expect(result[0].distanceMeters).toBe(500);
      // Verify KNN operator
      expect(mockQuery.mock.calls[0][0]).toContain('<->');
    });

    it('should apply maxDistanceMeters filter', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await service.findNearest(39.9, 32.8, 5, { maxDistanceMeters: 10000 });

      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('ST_DWithin');
      expect(mockQuery.mock.calls[0][1]).toContain(10000);
    });
  });

  describe('syncLocation', () => {
    it('should call query with ST_MakePoint', async () => {
      mockQuery.mockResolvedValueOnce(undefined);

      await service.syncLocation('parcel-123');

      expect(mockQuery.mock.calls[0][0]).toContain('ST_MakePoint');
      expect(mockQuery.mock.calls[0][1]).toEqual(['parcel-123']);
    });
  });

  describe('setBoundary', () => {
    it('should call query with ST_GeomFromGeoJSON and ST_IsValid', async () => {
      mockQuery.mockResolvedValueOnce([{ validity: 'valid' }]);

      const geojson = { type: 'Polygon', coordinates: [[[32, 39], [33, 39], [33, 40], [32, 40], [32, 39]]] };
      await service.setBoundary('parcel-123', geojson);

      expect(mockQuery.mock.calls[0][0]).toContain('ST_GeomFromGeoJSON');
      expect(mockQuery.mock.calls[0][0]).toContain('ST_IsValid');
      expect(mockQuery.mock.calls[0][1][0]).toBe(JSON.stringify(geojson));
    });

    it('should reject non-Polygon GeoJSON type', async () => {
      const geojson = { type: 'Point', coordinates: [32, 39] };

      await expect(
        service.setBoundary('parcel-123', geojson as Record<string, unknown>),
      ).rejects.toThrow('GeoJSON type must be "Polygon" or "MultiPolygon"');
    });

    it('should reject Polygon with too few coordinates', async () => {
      const geojson = { type: 'Polygon', coordinates: [[[32, 39], [33, 39]]] };

      await expect(
        service.setBoundary('parcel-123', geojson),
      ).rejects.toThrow('at least 4 coordinate pairs');
    });

    it('should reject empty coordinates array', async () => {
      const geojson = { type: 'Polygon', coordinates: [] };

      await expect(
        service.setBoundary('parcel-123', geojson),
      ).rejects.toThrow('non-empty array');
    });

    it('should throw when ST_IsValid returns invalid', async () => {
      mockQuery.mockResolvedValueOnce([{ validity: 'invalid' }]);

      const geojson = { type: 'Polygon', coordinates: [[[32, 39], [33, 39], [33, 40], [32, 40], [32, 39]]] };

      await expect(
        service.setBoundary('parcel-123', geojson),
      ).rejects.toThrow('self-intersecting or degenerate');
    });
  });

  describe('service-level limit enforcement', () => {
    it('should clamp radius to 100km max', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([]);

      await service.findWithinRadius(39.9, 32.8, 500_000); // 500km → clamped to 100km

      // Third parameter (radius) should be clamped to 100,000
      expect(mockQuery.mock.calls[0][1][2]).toBe(100_000);
    });

    it('should clamp findWithinRadius limit to 100', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([]);

      await service.findWithinRadius(39.9, 32.8, 5000, { limit: 999 });

      // Data query should have limit=100
      const dataParams = mockQuery.mock.calls[1][1];
      expect(dataParams[dataParams.length - 2]).toBe(100);
    });

    it('should clamp findInBoundingBox limit to 100', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([]);

      await service.findInBoundingBox(39, 32, 40, 33, { limit: 999 });

      const dataParams = mockQuery.mock.calls[1][1];
      expect(dataParams[dataParams.length - 2]).toBe(100);
    });

    it('should clamp findNearest limit to 50', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await service.findNearest(39.9, 32.8, 200);

      // Last param should be clamped to 50
      const params = mockQuery.mock.calls[0][1];
      expect(params[params.length - 1]).toBe(50);
    });

    it('should clamp maxDistanceMeters to 50km', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await service.findNearest(39.9, 32.8, 5, { maxDistanceMeters: 200_000 });

      // Should contain 50000 (clamped), not 200000
      expect(mockQuery.mock.calls[0][1]).toContain(50_000);
      expect(mockQuery.mock.calls[0][1]).not.toContain(200_000);
    });
  });
});
