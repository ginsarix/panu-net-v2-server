export interface Redis2FAContext {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  verificationCode: string;
}
