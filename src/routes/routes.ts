import { FastifyInstance } from 'fastify';
import { healthCheck } from '../controllers/healthController';
import {
  createUser,
  deleteUser,
  deleteUsers,
  getUser,
  getUsers,
  patchUser,
} from '../controllers/usersController';

export default async function routes(fastify: FastifyInstance) {
  fastify.get('/test', healthCheck);

  fastify.get('/users', getUsers);
  fastify.get('/users/:id', getUser);
  fastify.post('/users', createUser);
  fastify.patch('/users/:id', patchUser);
  fastify.delete('/users/:id', deleteUser);
  fastify.delete('/users', deleteUsers);
}
