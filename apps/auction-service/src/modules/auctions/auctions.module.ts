import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Auction } from './entities/auction.entity';
import { AuctionParticipant } from './entities/auction-participant.entity';
import { Bid } from './entities/bid.entity';
import { BidRejection } from './entities/bid-rejection.entity';
import { BidCorrection } from './entities/bid-correction.entity';
import { AuctionConsent } from './entities/auction-consent.entity';
import { SettlementManifest } from './entities/settlement-manifest.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { EventConsumerOffset } from './entities/event-consumer-offset.entity';
import { Deposit, DepositTransition, PaymentLedger, Refund } from '@nettapu/shared';
import { BidService } from './services/bid.service';
import { OutboxWriterService } from './services/outbox-writer.service';
import { AuctionService } from './services/auction.service';
import { RedisLockService } from './services/redis-lock.service';
import { SettlementService } from './services/settlement.service';
import { ConsentService } from './services/consent.service';
import { DepositLifecycleService } from './services/deposit-lifecycle.service';
import { PAYMENT_SERVICE, MockPaymentService } from './services/payment.service';
import { RealPaymentService } from './services/real-payment.service';
import { BidController } from './controllers/bid.controller';
import { AuctionController } from './controllers/auction.controller';
import { AdminSettlementController } from './controllers/admin-settlement.controller';
import { AdminFinanceController } from './controllers/admin-finance.controller';
import { MetricsService } from '../../metrics/metrics.service';
import { AuctionGateway } from './gateways/auction.gateway';
import { AuctionEndingWorker } from './workers/auction-ending.worker';
import { SettlementWorker } from './workers/settlement.worker';
import { OutboxRelayWorker } from './workers/outbox-relay.worker';
import { OutboxConsumerRegistry } from './events/outbox-consumer.registry';
import { WebSocketEventConsumer } from './events/consumers/websocket-event.consumer';
import { MetricsEventConsumer } from './events/consumers/metrics-event.consumer';
import { NotificationEventConsumer } from './events/consumers/notification-event.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Auction,
      AuctionParticipant,
      Bid,
      BidRejection,
      BidCorrection,
      AuctionConsent,
      SettlementManifest,
      OutboxEvent,
      EventConsumerOffset,
      Deposit,
      DepositTransition,
      PaymentLedger,
      Refund,
    ]),
  ],
  controllers: [AuctionController, BidController, AdminSettlementController, AdminFinanceController],
  providers: [
    AuctionService,
    ConsentService,
    BidService,
    RedisLockService,
    AuctionGateway,
    AuctionEndingWorker,
    DepositLifecycleService,
    SettlementService,
    SettlementWorker,
    OutboxWriterService,
    OutboxRelayWorker,
    OutboxConsumerRegistry,
    WebSocketEventConsumer,
    MetricsEventConsumer,
    NotificationEventConsumer,
    {
      provide: PAYMENT_SERVICE,
      useFactory: (config: ConfigService, metrics?: MetricsService) => {
        const provider = config.get<string>('POS_PROVIDER', 'mock');
        if (provider === 'mock') {
          return new MockPaymentService(metrics);
        }
        return new RealPaymentService(config, metrics);
      },
      inject: [ConfigService, { token: MetricsService, optional: true }],
    },
  ],
  exports: [TypeOrmModule, AuctionService, BidService, SettlementService, OutboxWriterService],
})
export class AuctionsModule {}
