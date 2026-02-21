import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Deposit, DepositTransition, PaymentLedger, Refund, POS_GATEWAY } from '@nettapu/shared';
import { Payment } from './entities/payment.entity';
import { PosTransaction } from './entities/pos-transaction.entity';
import { InstallmentPlan } from './entities/installment-plan.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { LedgerAnnotation } from './entities/ledger-annotation.entity';
import { PaymentService } from './services/payment.service';
import { RefundService } from './services/refund.service';
import { ReconciliationService } from './services/reconciliation.service';
import { FinancialLogger } from './services/financial-logger.service';
import { posGatewayFactory } from './services/pos-gateway.factory';
import { PaymentController } from './controllers/payment.controller';
import { RefundController } from './controllers/refund.controller';
import { ReconciliationController } from './controllers/reconciliation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Deposit,
      DepositTransition,
      Payment,
      PaymentLedger,
      PosTransaction,
      Refund,
      InstallmentPlan,
      IdempotencyKey,
      LedgerAnnotation,
    ]),
  ],
  controllers: [PaymentController, RefundController, ReconciliationController],
  providers: [
    PaymentService,
    RefundService,
    ReconciliationService,
    FinancialLogger,
    {
      provide: POS_GATEWAY,
      useFactory: posGatewayFactory,
      inject: [ConfigService],
    },
  ],
  exports: [PaymentService, RefundService, FinancialLogger],
})
export class PaymentsModule {}
