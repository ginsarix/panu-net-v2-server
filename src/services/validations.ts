import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1, 'İsim gereklidir.'),
  email: z.string().email('Geçerli bir email gereklidir.'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı.'),
  role: z.string().optional(),
  phone: z.string().optional(),
});

const UpdateUserSchema = z
  .object({
    name: z.string().min(1, 'İsim geçersiz.').optional(),
    email: z.string().email('Geçersiz e-posta').optional(),
    password: z.string().min(6, 'Şifre en az 6 karakter olmalı.').optional(),
    phone: z.string().min(1, 'Telefon geçersiz.').optional(),
    role: z.string().min(1, 'Rol geçersiz.').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'En az bir alan güncellenmelidir.',
  });

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export function validateCreateUser(body: unknown) {
  const result = CreateUserSchema.safeParse(body);
  return result.success
    ? { isValid: true, value: result.data }
    : { isValid: false, errors: result.error.errors.map((e) => e.message) };
}

export function validateUpdateUser(body: unknown) {
  const result = UpdateUserSchema.safeParse(body);
  return result.success
    ? { isValid: true, value: result.data }
    : { isValid: false, errors: result.error.errors.map((e) => e.message) };
}
