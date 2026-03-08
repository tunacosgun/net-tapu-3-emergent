import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getOverview(period: string) {
    const periodDays = { week: 7, month: 30, quarter: 90, year: 365 }[period] ?? 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - periodDays);
    const since = sinceDate.toISOString();

    const [parcels, auctions, users, payments, contacts, campaigns] = await Promise.all([
      this.getParcelStats(since),
      this.getAuctionStats(since),
      this.getUserStats(since),
      this.getPaymentStats(since),
      this.getContactStats(since),
      this.getCampaignStats(),
    ]);

    return { period, periodDays, since, parcels, auctions, users, payments, contacts, campaigns };
  }

  /** Daily time-series for dashboard charts */
  async getTimeSeries(period: string) {
    const periodDays = { week: 7, month: 30, quarter: 90, year: 365 }[period] ?? 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - periodDays);
    const since = sinceDate.toISOString();

    const [registrations, payments, listings, contacts] = await Promise.all([
      this.getDailyTimeSeries('auth.users', 'created_at', since),
      this.getDailyTimeSeries('payments.payments', 'created_at', since),
      this.getDailyTimeSeries('listings.parcels', 'created_at', since),
      this.getDailyTimeSeries('crm.contact_requests', 'created_at', since),
    ]);

    return { period, periodDays, registrations, payments, listings, contacts };
  }

  /** Revenue time-series (daily completed payment totals) */
  async getRevenueTrend(period: string) {
    const periodDays = { week: 7, month: 30, quarter: 90, year: 365 }[period] ?? 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - periodDays);
    const since = sinceDate.toISOString();

    try {
      const result = await this.dataSource.query(`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS count,
          COALESCE(SUM(amount::numeric), 0) AS revenue
        FROM payments.payments
        WHERE created_at >= $1 AND status = 'completed'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [since]);
      return { period, periodDays, data: result };
    } catch {
      return { period, periodDays, data: [] };
    }
  }

  /** Top parcels by favorites and views */
  async getTopParcels(limit = 10) {
    try {
      const [byFavorites, byViews] = await Promise.all([
        this.dataSource.query(`
          SELECT
            p.id, p.listing_id, p.title, p.city, p.district, p.price, p.status,
            COUNT(f.id) AS favorite_count
          FROM listings.parcels p
          LEFT JOIN listings.favorites f ON f.parcel_id = p.id
          WHERE p.status = 'active'
          GROUP BY p.id
          ORDER BY favorite_count DESC
          LIMIT $1
        `, [limit]),
        this.dataSource.query(`
          SELECT
            p.id, p.listing_id, p.title, p.city, p.district, p.price, p.status,
            COUNT(a.id) AS view_count
          FROM listings.parcels p
          LEFT JOIN crm.user_activity_log a
            ON a.resource_id = p.id::text AND a.resource_type = 'parcel' AND a.action = 'view'
          WHERE p.status = 'active'
          GROUP BY p.id
          ORDER BY view_count DESC
          LIMIT $1
        `, [limit]),
      ]);
      return { byFavorites, byViews };
    } catch {
      return { byFavorites: [], byViews: [] };
    }
  }

  /** Recent admin activity feed */
  async getRecentActivity(limit = 20) {
    try {
      const result = await this.dataSource.query(`
        SELECT
          al.id, al.actor_id, al.actor_role, al.action,
          al.resource_type, al.resource_id,
          al.created_at,
          u.first_name, u.last_name, u.email
        FROM admin.audit_log al
        LEFT JOIN auth.users u ON u.id = al.actor_id
        ORDER BY al.created_at DESC
        LIMIT $1
      `, [limit]);
      return result;
    } catch {
      return [];
    }
  }

  /** City-level distribution for map heat data */
  async getParcelDistribution() {
    try {
      const result = await this.dataSource.query(`
        SELECT
          city,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'active') AS active,
          COUNT(*) FILTER (WHERE status = 'sold') AS sold,
          COALESCE(AVG(price::numeric) FILTER (WHERE status = 'active' AND price IS NOT NULL), 0) AS avg_price
        FROM listings.parcels
        GROUP BY city
        ORDER BY total DESC
      `);
      return result;
    } catch {
      return [];
    }
  }

  /** CRM call center dashboard — pending contacts, upcoming appointments, recent offers */
  async getCrmDashboard() {
    try {
      const [pendingContacts, upcomingAppointments, recentOffers, consultantLoad] =
        await Promise.all([
          this.dataSource.query(`
            SELECT
              cr.id, cr.type, cr.name, cr.phone, cr.email, cr.message,
              cr.status, cr.parcel_id, cr.created_at,
              p.title AS parcel_title, p.city, p.district
            FROM crm.contact_requests cr
            LEFT JOIN listings.parcels p ON p.id = cr.parcel_id
            WHERE cr.status IN ('new', 'in_progress')
            ORDER BY cr.created_at DESC
            LIMIT 50
          `),
          this.dataSource.query(`
            SELECT
              a.id, a.user_id, a.parcel_id, a.consultant_id,
              a.scheduled_at, a.duration_minutes, a.location, a.status, a.notes,
              u.first_name, u.last_name, u.phone,
              p.title AS parcel_title, p.city
            FROM crm.appointments a
            LEFT JOIN auth.users u ON u.id = a.user_id
            LEFT JOIN listings.parcels p ON p.id = a.parcel_id
            WHERE a.scheduled_at >= NOW() AND a.status IN ('scheduled', 'confirmed')
            ORDER BY a.scheduled_at ASC
            LIMIT 20
          `),
          this.dataSource.query(`
            SELECT
              o.id, o.parcel_id, o.user_id, o.amount, o.currency,
              o.status, o.message, o.created_at,
              u.first_name, u.last_name, u.phone, u.email,
              p.title AS parcel_title, p.city, p.price AS listing_price
            FROM crm.offers o
            JOIN auth.users u ON u.id = o.user_id
            JOIN listings.parcels p ON p.id = o.parcel_id
            WHERE o.status = 'pending'
            ORDER BY o.created_at DESC
            LIMIT 20
          `),
          this.dataSource.query(`
            SELECT
              u.id, u.first_name, u.last_name,
              COUNT(cr.id) FILTER (WHERE cr.status IN ('new', 'in_progress')) AS open_contacts,
              COUNT(a.id) FILTER (WHERE a.scheduled_at >= NOW() AND a.status IN ('scheduled', 'confirmed')) AS upcoming_appointments
            FROM auth.users u
            JOIN auth.user_roles ur ON ur.user_id = u.id AND ur.role_id IN (4, 5)
            LEFT JOIN crm.contact_requests cr ON cr.assigned_to = u.id
            LEFT JOIN crm.appointments a ON a.consultant_id = u.id
            GROUP BY u.id
            ORDER BY open_contacts DESC
          `),
        ]);

      return {
        pendingContacts,
        upcomingAppointments,
        recentOffers,
        consultantLoad,
        summary: {
          totalPendingContacts: pendingContacts.length,
          totalUpcomingAppointments: upcomingAppointments.length,
          totalPendingOffers: recentOffers.length,
        },
      };
    } catch (error) {
      this.logger.error('CRM dashboard query failed', error);
      return {
        pendingContacts: [],
        upcomingAppointments: [],
        recentOffers: [],
        consultantLoad: [],
        summary: { totalPendingContacts: 0, totalUpcomingAppointments: 0, totalPendingOffers: 0 },
      };
    }
  }

  // ── Private helper methods ──────────────────────────────────

  private async getDailyTimeSeries(table: string, column: string, since: string) {
    try {
      const result = await this.dataSource.query(`
        SELECT DATE("${column}") AS date, COUNT(*) AS count
        FROM ${table}
        WHERE "${column}" >= $1
        GROUP BY DATE("${column}")
        ORDER BY date ASC
      `, [since]);
      return result;
    } catch {
      return [];
    }
  }

  private async getParcelStats(since: string) {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'active') AS active,
          COUNT(*) FILTER (WHERE status = 'sold') AS sold,
          COUNT(*) FILTER (WHERE status = 'draft') AS draft,
          COUNT(*) FILTER (WHERE status = 'deposit_taken') AS deposit_taken,
          COUNT(*) FILTER (WHERE status = 'withdrawn') AS withdrawn,
          COUNT(*) FILTER (WHERE created_at >= $1) AS new_in_period
        FROM listings.parcels
      `, [since]);
      return result[0] ?? {};
    } catch {
      return {};
    }
  }

  private async getAuctionStats(since: string) {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'active') AS active,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
          COALESCE(SUM(bid_count), 0) AS total_bids,
          COALESCE(SUM(participant_count), 0) AS total_participants,
          COUNT(*) FILTER (WHERE created_at >= $1) AS new_in_period
        FROM auctions.auctions
      `, [since]);
      return result[0] ?? {};
    } catch {
      return {};
    }
  }

  private async getUserStats(since: string) {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE is_email_verified = true) AS verified,
          COUNT(*) FILTER (WHERE is_locked = true) AS locked,
          COUNT(*) FILTER (WHERE created_at >= $1) AS new_in_period
        FROM auth.users
      `, [since]);
      return result[0] ?? {};
    } catch {
      return {};
    }
  }

  private async getPaymentStats(since: string) {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          COALESCE(SUM(amount::numeric) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
          COUNT(*) FILTER (WHERE created_at >= $1) AS new_in_period
        FROM payments.payments
      `, [since]);
      return result[0] ?? {};
    } catch {
      return {};
    }
  }

  private async getContactStats(since: string) {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'new') AS new_requests,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE created_at >= $1) AS new_in_period
        FROM crm.contact_requests
      `, [since]);
      return result[0] ?? {};
    } catch {
      return {};
    }
  }

  private async getCampaignStats() {
    try {
      const result = await this.dataSource.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'active') AS active,
          COUNT(*) FILTER (WHERE status = 'draft') AS draft,
          COUNT(*) FILTER (WHERE status = 'ended') AS ended
        FROM campaigns.campaigns
      `);
      return result[0] ?? {};
    } catch {
      return {};
    }
  }

  /** Get auction participants with real names (admin only) */
  async getAuctionParticipantNames(auctionId: string): Promise<
    Array<{ userId: string; userIdMasked: string; fullName: string; email: string }>
  > {
    const rows = await this.dataSource.query(
      `SELECT
         ap.user_id,
         u.first_name,
         u.last_name,
         u.email
       FROM auctions.auction_participants ap
       JOIN auth.users u ON u.id = ap.user_id
       WHERE ap.auction_id = $1 AND ap.eligible = TRUE
       ORDER BY ap.registered_at`,
      [auctionId],
    );

    return rows.map((r: any) => ({
      userId: r.user_id,
      userIdMasked: r.user_id.slice(0, 8) + '***',
      fullName: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email,
      email: r.email,
    }));
  }
}
