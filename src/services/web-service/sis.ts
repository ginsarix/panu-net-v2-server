import { TRPCError } from '@trpc/server';
import type { FastifyRequest } from 'fastify';

import { unauthorizedErrorMessage, unexpectedErrorMessage } from '../../constants/messages';
import myAxios from '../../services/api-base';
import type {
  WsGetCreditCountResponse,
  WsGetPeriodsResponse,
  WsLoginResponse,
  WsResponse,
} from '../../types/web-service';
import {
  constructGetCreditCount,
  constructGetPeriods,
  constructLogin,
  constructPing,
  sourceWithSis,
} from '../../utils/web-service';
import { getCompanyById } from '../companiesDb';

type LoginResult = 'successfully_logged_in' | 'already_logged_in' | 'api_error';

export const login = async (request: FastifyRequest): Promise<LoginResult> => {
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

  if (request.session.wsSessionId) {
    const pingResponse = await myAxios.post<Omit<WsResponse, 'msg'>>(
      sourceWithSis(result.webServiceSource),
      constructPing(request.session.wsSessionId),
    );

    if (pingResponse.data.code === '200') return 'already_logged_in';
  }

  const response = await myAxios.post<WsLoginResponse>(
    sourceWithSis(result.webServiceSource),
    constructLogin(result.webServiceUsername, result.apiSecret, { apikey: result.apiKey }),
  );

  if (response.data.code === '200') {
    request.session.wsSessionId = response.data.msg;
    return 'successfully_logged_in';
  } else {
    console.error(response);
    return 'api_error';
  }
};

export const getPeriods = async (request: FastifyRequest, companyCode: number) => {
  if (!request.session.wsSessionId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: unauthorizedErrorMessage,
    });
  }

  const selectedCompanyId = request.session.selectedCompanyId;

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
    constructGetPeriods(request.session.wsSessionId, companyCode, {
      selectedcolumns: ['m_donemler'],
    }),
  );

  return response.data;
};

export const getWsCreditCount = async (request: FastifyRequest) => {
  if (!request.session.wsSessionId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: unauthorizedErrorMessage,
    });
  }

  const selectedCompanyId = request.session.selectedCompanyId;

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
    constructGetCreditCount(request.session.wsSessionId),
  );

  return response.data;
};
