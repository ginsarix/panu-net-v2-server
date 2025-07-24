import { TRPCError } from '@trpc/server';
import { FastifyRequest } from 'fastify';

import { sisEndpoint } from '../../constants/endpoints.ts';
import { unexpectedErrorMessage } from '../../constants/messages.ts';
import myAxios from '../../services/api-base.ts';
import { WsResponse } from '../../types/web-service.ts';
import { constructLogin, sourceWithSlash } from '../../utils/web-service.ts';
import { getCompanyById } from '../companiesDb.ts';

const sourceWithSis = (wsSource: string) => {
  sourceWithSlash(wsSource);

  return wsSource + sisEndpoint;
};

export const login = async (request: FastifyRequest) => {
  if (!request.session.selectedCompanyId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Seçili şirket bulunamadı.',
    });
  }

  const [message, code, result] = await getCompanyById(request.session.selectedCompanyId);
  if (!result) {
    throw new TRPCError({
      code: code || 'INTERNAL_SERVER_ERROR',
      message: message || unexpectedErrorMessage,
    });
  }

  const response = await myAxios.post<WsResponse>(
    sourceWithSis(result.webServiceSource),
    constructLogin(result.webServiceUsername, result.apiSecret, { apikey: result.apiKey }),
  );

  if (response.data.code === '200') request.session.wsSessionId = response.data.msg;
  else console.error(response);
};
