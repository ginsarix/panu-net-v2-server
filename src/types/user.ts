export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: string;
  creationDate: Date;
  updatedOn: Date;
}

export type PublicUser = Omit<User, 'password'>;
