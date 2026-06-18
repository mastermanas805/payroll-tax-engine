import { IsIn, IsNumber, Min } from 'class-validator';
import { PayBasis } from 'src/shared';

/**
 * Nested pay-basis input (D9: both CTC and GROSS supported, CTC primary).
 * `amount` is a monthly figure in the ruleset currency; negatives are rejected (NFR-7).
 */
export class PayBasisDto implements PayBasis {
  @IsIn(['CTC', 'GROSS'], { message: 'payBasis.type must be CTC or GROSS' })
  type!: 'CTC' | 'GROSS';

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'payBasis.amount must be a number' })
  @Min(0, { message: 'payBasis.amount must not be negative' })
  amount!: number;
}
