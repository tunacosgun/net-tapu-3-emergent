import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Deposit, DepositTransition, PaymentLedger, Refund, POS_GATEWAY } from '@nettapu/shared';
import { Payment } from './entities/payment.entity';
import { PosTransaction } from './entities/pos-transaction.entity';
import { InstallmentPlan } from './entities/installment-plan.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { LedgerAnnotation } from './entities/ledger-annotation.entity';
import { ReconciliationRun } from './entities/reconciliation-run.entity';
import { PaymentService } from './services/payment.service';
import { RefundService } from './services/refund.service';
import { ReconciliationService } from './services/reconciliation.service';
import { ReconciliationWorker } from './services/reconciliation.worker';
import { PosCallbackService } from './services/pos-callback.service';
import { FinancialLogger } from './services/financial-logger.service';
import { posGatewayFactory } from './services/pos-gateway.factory';
import { PaymentController } from './controllers/payment.controller';
import { DepositController } from './controllers/deposit.controller';
import { RefundController } from './controllers/refund.controller';
import { ReconciliationController } from './controllers/reconciliation.controller';
import { PosCallbackController } from './controllers/pos-callback.controller';

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
      ReconciliationRun,
    ]),
  ],
  controllers: [PaymentController, DepositController, RefundController, ReconciliationController, PosCallbackController],
  providers: [
    PaymentService,
    RefundService,
    ReconciliationService,
    PosCallbackService,
    ReconciliationWorker,
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
