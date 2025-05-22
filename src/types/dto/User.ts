export interface CreateUserDto {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: string;
}
