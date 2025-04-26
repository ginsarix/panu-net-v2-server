import { Sequelize } from 'sequelize-typescript'

export default new Sequelize({
  dialect: 'mysql',
  host: 'localhost',
  username: 'root',
  password: 'Hkd12121*',
  database: 'panunet_v2',
  logging: false,
  models: ['src/models'],
});