import User from '../models/User.ts';
import { type WithUnknown } from '../types/WithUnknown.ts';

interface Validations {
  errors: string[];
  isValid: boolean;
}

export const validateUser = (user: WithUnknown<User>): Validations => {
  const errors: string[] = [];

  if (typeof user.name !== 'string' || user.name.length < 2) {
    errors.push('Kullanıcı isminin en az 2 karakteri olmalıdır.');
  }
  if (typeof user.email !== 'string' || !/\S+@\S+\.\S+/.test(user.email)) {
    errors.push('E-posta geçerli bir e-posta olmalıdır.');
  }
  if (typeof user.password !== 'string' || user.password.length < 8) {
    errors.push('Parola en az 8 karakter olmalıdır.');
  }

  return {
    errors,
    isValid: errors.length === 0,
  };
};
