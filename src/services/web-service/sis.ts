import { FastifyReply, FastifyRequest } from 'fastify';
import myAxios from '../services/api-base.ts';
import { getCompanyById } from './companiesDb.ts';
import { WsResponse } from '../types/web-service.ts';
import { constructLogin } from '../utils/web-service.ts';

export const login = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.session.selectedCompanyId) {
    reply.status(400).send({ error: 'Seçili şirket bulunamadı.' });
    return;
  }

  const [message, statusCode, result] = await getCompanyById(request.session.selectedCompanyId);
  if (!result) {
    reply.status(statusCode).send({ error: message });
    return;
  }

  const wsSource = result.webServiceSource.endsWith('/') ? result.webServiceSource : result.webServiceSource + '/';

  const response = await myAxios.post<WsResponse>(
    wsSource + 'sis/json',
    constructLogin(result.webServiceUsername, result.apiSecret, { apikey: result.apiKey }),
  );

  if (response.status === 200) request.session.wsSessionId = response.data.msg;
  else console.error(response);
}