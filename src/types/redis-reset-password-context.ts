export interface RedisResetPasswordContext {
  email: string;
  newPassword: string;
  verificationCode: string;
}
