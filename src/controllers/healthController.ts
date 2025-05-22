import { FastifyRequest, FastifyReply } from 'fastify';

export async function healthCheck(request: FastifyRequest, reply: FastifyReply) {
  reply.send({ status: 'ok' });
}
