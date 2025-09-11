import { TRPCError } from '@trpc/server';
import type { FastifyRequest } from 'fastify';

import { unauthorizedErrorMessage, unexpectedErrorMessage } from '../../constants/messages';
import myAxios from '../../services/api-base';
import type {
  WsGetCreditCountResponse,
  WsGetPeriodsResponse,
  WsLoginResponse,
} from '../../types/web-service';
import {
  constructGetCreditCount,
  constructGetPeriods,
  constructLogin,
  sourceWithSis,
} from '../../utils/web-service';
import { getCompanyById } from '../companiesDb';

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

  const response = await myAxios.post<WsLoginResponse>(
    sourceWithSis(result.webServiceSource),
    constructLogin(result.webServiceUsername, result.apiSecret, { apikey: result.apiKey }),
  );

  if (response.data.code === '200') request.session.wsSessionId = response.data.msg;
  else console.error(response);
};

export const getPeriods = async (request: FastifyRequest, companyCode: string) => {
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
