import { IsString, IsUUID, IsEnum, IsOptional, MaxLength, IsNotEmpty, Matches, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { PaymentMethod } from '@nettapu/shared';

@ValidatorConstraint({ name: 'isPositiveAmount', async: false })
class IsPositiveAmount implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    return parseFloat(value) > 0;
  }
  defaultMessage(): string {
    return 'amount must be greater than zero';
  }
}

export class InitiatePaymentDto {
  @IsUUID()
  parcelId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/, {
    message: 'amount must be a positive decimal with up to 2 decimal places (e.g. "100.50")',
  })
  @Validate(IsPositiveAmount)
  amount!: string;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  idempotencyKey!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  cardToken?: string;
}
