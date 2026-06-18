import { Employer } from 'src/shared';

/**
 * Public projection of an Employer — the safe shape returned to API clients.
 * Crucially omits `passwordHash`, which must never be serialized (domain contract).
 */
export type EmployerView = Omit<Employer, 'passwordHash'>;

/** Response envelope for register/login: a signed JWT + the public employer. */
export interface AuthResult {
  accessToken: string;
  employer: EmployerView;
}

/** Strip the password hash off a stored Employer before it leaves the service. */
export function toEmployerView(employer: Employer): EmployerView {
  // Pull out passwordHash and return the rest; never spread it back.
  const { passwordHash: _passwordHash, ...view } = employer;
  return view;
}
