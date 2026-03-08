import { IsString, IsNotEmpty, MinLength } from 'class-validator';

/**
 * DTO for accepting auction participation consent.
 * User must accept legal terms before placing bids.
 */
export class AcceptConsentDto {
  /**
   * The full consent text that was displayed to the user.
   * Server will hash this (SHA-256) and store the hash for legal proof.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  consentText!: string;
}
