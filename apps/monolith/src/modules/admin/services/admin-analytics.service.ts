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

    // Run aggregate queries in parallel
    const [parcels, auctions, users, payments, contacts, campaigns] = await Promise.all([
      this.getParcelStats(since),
      this.getAuctionStats(since),
      this.getUserStats(since),
      this.getPaymentStats(since),
      this.getContactStats(since),
      this.getCampaignStats(),
    ]);

    return {
      period,
      periodDays,
      since,
      parcels,
      auctions,
      users,
      payments,
      contacts,
      campaigns,
    };
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
}
