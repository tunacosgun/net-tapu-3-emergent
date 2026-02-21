import { IsString, IsUUID, IsNotEmpty, IsOptional, MaxLength, Matches, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'isPositiveAmount', async: false })
class IsPositiveAmount implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    return parseFloat(value) > 0;
  }
  defaultMessage(): string {
    return 'amount must be greater than zero';
  }
}

export class InitiateRefundDto {
  @IsUUID()
  paymentId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{1,13}(\.\d{1,2})?$/, {
    message: 'amount must be a positive decimal with up to 2 decimal places (e.g. "100.50")',
  })
  @Validate(IsPositiveAmount)
  amount!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  idempotencyKey!: string;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;
}
