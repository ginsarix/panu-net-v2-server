import { Table, Column, Model, CreatedAt, UpdatedAt, Default, PrimaryKey } from 'sequelize-typescript';

@Table
export default class User extends Model {
  @PrimaryKey
  @Column
  declare id: number;

  @Column
  name!: string;

  @Column
  email!: string;

  @Column
  phone?: string;

  @Column
  password!: string;

  @Column
  @Default('user')
  role!: string;

  @CreatedAt
  creationDate!: Date;

  @UpdatedAt
  updatedOn!: Date;
}