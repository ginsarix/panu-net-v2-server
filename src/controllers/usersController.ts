import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db';
import { users } from '../db/schema/user';
import { eq, inArray, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { validateCreateUser, validateUpdateUser } from '../services/validations';
import { PublicUser, User } from '../types/User.ts';
import { getRedis, ttlToHeader } from '../services/redis.ts';

const saltRounds = 12;
const userIdRequiredMessage = "Kullanıcı ID'si gereklidir.";
const idInvalidMessage = 'ID geçersiz.';
const userNotFoundMessage = 'Kullanıcı bulunamadı.';
const couldntFetchUsersMessage = 'Kullanıcılar getirilemedi.';

const parseId = (str: string) => parseInt(str, 10);

const stripSensitive = (user: User): PublicUser => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = user;
  return rest;
};

const fetchUserById = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = request.params;
  if (!id) {
    reply.status(400).send({ error: userIdRequiredMessage });
    return null;
  }
  const userId = parseId(id);

  if (isNaN(userId)) {
    reply.status(400).send({ error: idInvalidMessage });
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .then((rows) => rows[0]);

  if (!user.creationDate) {
    reply.status(404).send({ error: userNotFoundMessage });
    return null;
  }

  return user;
};

export const getUsers = async (
  request: FastifyRequest<{ Querystring: { limit?: number; skip?: number } }>,
  reply: FastifyReply,
) => {
  try {
    const { limit = 10, skip = 0 } = request.query;

    const redis = getRedis();
    const cacheKey = `users:${skip}:${limit}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.header('X-Cache-Status', 'HIT');
      await ttlToHeader(cacheKey, reply);
      return reply.status(200).send(JSON.parse(cached));
    }

    const allUsers = await db
      .select()
      .from(users)
      .orderBy(users.creationDate)
      .offset(skip)
      .limit(limit);

    const result = allUsers.map(stripSensitive);
    await redis.set(cacheKey, JSON.stringify(result));
    await redis.expire(cacheKey, 45);

    reply.header('X-Cache-Status', 'MISS');

    reply.status(200).send(result);
  } catch (error) {
    console.error('Failed to fetch users: ', error);
    reply.status(500).send({ error: couldntFetchUsersMessage });
  }
};

export const getUserCount = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const totalUsersResult = await db.select({ count: sql`count(*)` }).from(users);
    const totalUsers = Number(totalUsersResult[0]?.count) || 0;

    reply.status(200).send(totalUsers);
  } catch (error) {
    console.error('Failed to fetch user count: ', error);
    reply.status(500).send({ error: couldntFetchUsersMessage });
  }
};

export const getUser = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  try {
    const user = await fetchUserById(request, reply);
    if (!user) return;
    reply.status(200).send(stripSensitive(user));
  } catch (error) {
    console.error('Failed to fetch user: ', error);
    reply.status(500).send({ error: couldntFetchUsersMessage });
  }
};

export const createUser = async (
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply,
) => {
  try {
    const validation = validateCreateUser(request.body);
    if (!validation.isValid) {
      reply.status(400).send({ errors: validation.errors });
      return;
    }
    const userDto = validation.value!;

    userDto.password = await bcrypt.hash(userDto.password, saltRounds);

    await db.insert(users).values(userDto);
    reply.status(201).send({ message: 'Kullanıcı başarıyla oluşturuldu.' });
  } catch (error) {
    console.error('Failed to create user: ', error);
    reply.status(500).send({ error: 'Kullanıcı oluşturulurken bir hata ile karşılaşıldı.' });
  }
};

export const patchUser = async (
  request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
  reply: FastifyReply,
) => {
  try {
    const userId = parseId(request.params.id);

    if (isNaN(userId)) {
      reply.status(400).send({ error: 'Invalid ID' });
      return;
    }

    const validation = validateUpdateUser(request.body);
    if (!validation.isValid) {
      reply.status(400).send({ error: validation.errors });
      return;
    }
    const updateDto = validation.value!;

    if (updateDto.password) {
      updateDto.password = await bcrypt.hash(updateDto.password, saltRounds);
    }

    const result = await db.update(users).set(updateDto).where(eq(users.id, userId));

    if (result.rowCount === 0) {
      reply.status(404).send({ error: userNotFoundMessage });
      return;
    }

    reply.status(200).send({ message: 'Kullanıcı güncellendi.' });
  } catch (error) {
    console.error('Failed to patch user: ', error);
    reply.status(500).send({ error: 'Kullanıcı düzenlenirken bir hata ile karşılaşıldı.' });
  }
};

export const deleteUser = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  try {
    const user = await fetchUserById(request, reply);
    if (!user) return;

    const result = await db.delete(users).where(eq(users.id, user.id));

    if (result.rowCount === 0) {
      reply.status(404).send({ error: userNotFoundMessage });
      return;
    }

    reply.status(200).send({ message: 'Kullanıcı silindi.' });
  } catch (error) {
    console.error('Failed to delete user: ', error);
    reply.status(500).send({ error: 'Kullanıcı silinirken bir hata ile karşılaşıldı.' });
  }
};

export const deleteUsers = async (
  request: FastifyRequest<{ Body: { ids: string[] } }>,
  reply: FastifyReply,
) => {
  try {
    const { ids } = request.body;

    if (!ids || ids.length === 0) {
      reply.status(400).send({ error: "Kullanıcı ID'leri gereklidir." });
      return;
    }

    const parsedIds = ids.map((id) => parseInt(id, 10));
    const invalidIds = parsedIds.filter((id) => isNaN(id));
    if (invalidIds.length > 0) {
      reply.status(400).send({ error: "Geçersiz ID'ler sağlandı." });
      return;
    }

    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, parsedIds));

    const existingIds = new Set(existingUsers.map((u) => u.id));

    const result = await db.delete(users).where(inArray(users.id, parsedIds));

    if (result.rowCount === 0) {
      reply.status(404).send({ error: userNotFoundMessage });
      return;
    }

    const results = ids.map((id) => {
      const numId = parseInt(id, 10);
      return {
        id,
        status: existingIds.has(numId),
        message: existingIds.has(numId) ? 'Kullanıcı silindi' : 'Kullanıcı bulunamadı',
      };
    });

    if (result.rowCount !== ids.length) {
      reply.status(200).send({
        error: 'Bazı kullanıcılar silindi, bazıları bulunamadı.',
        results,
      });
      return;
    }

    reply.status(200).send({
      message: 'Silme operasyonu hatasız geçti',
      deletedRows: result.rowCount,
      results,
    });
  } catch (error) {
    console.error('An error occurred while deleting users: ', error);
    reply.status(500).send({
      error: 'Kullanıcılar silinirken bir hata ile karşılaşıldı.',
    });
  }
};
