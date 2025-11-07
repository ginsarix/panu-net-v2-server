import { TRPCError } from '@trpc/server';
import type { FastifyRequest } from 'fastify';

import {
  selectedCompanyNotFoundMessage,
  unauthorizedErrorMessage,
  unexpectedErrorMessage,
} from '../../constants/messages.js';
import myAxios from '../../services/api-base.js';
import { creditCountEmitter } from '../../services/credit-count-emitter.js';
import { getLogger } from '../../services/logger.js';
import type {
  WsGetCreditCountResponse,
  WsGetPeriodsResponse,
  WsLoginResponse,
  WsResponse,
} from '../../types/web-service.js';
import {
  constructGetCreditCount,
  constructGetPeriods,
  constructLogin,
  constructPing,
  sourceWithSis,
} from '../../utils/web-service.js';
import { getCompanyById } from '../companiesDb.js';

type LoginResult = 'successfully_logged_in' | 'already_logged_in' | 'api_error';

export const login = async (request: FastifyRequest): Promise<LoginResult> => {
  const selectedCompanyId = request.session.get('selectedCompanyId');
  if (!selectedCompanyId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: selectedCompanyNotFoundMessage,
    });
  }

  const [message, code, result] = await getCompanyById(selectedCompanyId);
  if (!result) {
    throw new TRPCError({
      code: code || 'INTERNAL_SERVER_ERROR',
      message: message || unexpectedErrorMessage,
    });
  }

  const wsSessionId = request.session.get('wsSessionId');
  if (wsSessionId) {
    const pingResponse = await myAxios.post<Omit<WsResponse, 'msg'>>(
      sourceWithSis(result.webServiceSource),
      constructPing(wsSessionId),
    );

    if (pingResponse.data.code === '200') return 'already_logged_in';
  }

  const response = await myAxios.post<WsLoginResponse>(
    sourceWithSis(result.webServiceSource),
    constructLogin(result.webServiceUsername, result.apiSecret, { apikey: result.apiKey }),
  );

  if (response.data.code === '200') {
    request.session.set('wsSessionId', response.data.msg);
    await request.session.save();
    return 'successfully_logged_in';
  } else {
    getLogger().error(response, 'API error response');
    return 'api_error';
  }
};

export const getPeriods = async (request: FastifyRequest, companyCode: number) => {
  const wsSessionId = request.session.get('wsSessionId');
  if (!wsSessionId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: unauthorizedErrorMessage,
    });
  }

  const selectedCompanyId = request.session.get('selectedCompanyId');

  if (!selectedCompanyId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Seçili şirket bulunmamaktadır.',
    });
  }

  const [message, code, result] = await getCompanyById(selectedCompanyId);
  if (!result) {
    throw new TRPCError({
      code: code || 'INTERNAL_SERVER_ERROR',
      message: message || unexpectedErrorMessage,
    });
  }

  const response = await myAxios.post<WsGetPeriodsResponse>(
    sourceWithSis(result.webServiceSource),
    constructGetPeriods(wsSessionId, companyCode, {
      selectedcolumns: ['m_donemler'],
    }),
  );

  // Emit credit count change event after web service call
  try {
    await getWsCreditCount(request);
  } catch (error) {
    // Log but don't fail if credit count fetch fails
    getLogger().error(error, 'Failed to fetch credit count after getPeriods');
  }

  return response.data;
};

export const getWsCreditCount = async (request: FastifyRequest) => {
  const wsSessionId = request.session.get('wsSessionId');
  if (!wsSessionId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: unauthorizedErrorMessage,
    });
  }

  const selectedCompanyId = request.session.get('selectedCompanyId');

  if (!selectedCompanyId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Seçili şirket bulunmamaktadır.',
    });
  }

  const [message, code, result] = await getCompanyById(selectedCompanyId);
  if (!result) {
    throw new TRPCError({
      code: code || 'INTERNAL_SERVER_ERROR',
      message: message || unexpectedErrorMessage,
    });
  }

  const response = await myAxios.post<WsGetCreditCountResponse>(
    sourceWithSis(result.webServiceSource),
    constructGetCreditCount(wsSessionId),
  );

  // Emit credit count change event
  const creditCount = response.data.result.kontorsayisi;
  creditCountEmitter.emitCreditCountChange(selectedCompanyId, creditCount);

  return response.data;
};
