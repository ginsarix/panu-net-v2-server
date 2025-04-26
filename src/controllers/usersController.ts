import { Request, Response } from 'express';
import User from '../models/User.ts';
import * as bcrypt from 'bcrypt';
import { validateUser } from '../services/validations.ts';

const saltRounds = 12;
const userIdRequiredMessage = "Kullanıcı ID'si gereklidir.";
const idInvalidMessage = 'ID geçersiz.';
const userNotFoundMessage = 'Kullanıcılar bulunamadı.';

const parseId = (str: string) => parseInt(str, 10);

const fetchUserById = async (req: Request, res: Response): Promise<User | null> => {
  if (!req.params.id) {
    res.status(400).json({ error: userIdRequiredMessage });
    return null;
  }
  const userId = parseId(req.params.id);

  if (isNaN(userId)) {
    res.status(400).json({ error: idInvalidMessage });
    return null;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    res.status(404).json({ error: userNotFoundMessage });
    return null;
  }

  return user;
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.findAll();
    res.status(200).json(users);
  } catch (error) {
    console.error('Failed to fetch users: ', error);
    res.status(500).json({ error: 'Kullanıcılar getirilemedi' });
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const user = await fetchUserById(req, res);
    if (!user) return;
    res.status(200).json(user);
  } catch (error) {
    console.error('Failed to fetch user: ', error);
    res.status(500).json({ error: 'Kullanıcı getirilemedi' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const userDto = req.body;

    const validations = validateUser(userDto);
    if (!validations.isValid) {
      res.status(400).json({ errors: validations.errors });
      return;
    }

    userDto.password = await bcrypt.hash(userDto.password, saltRounds);

    await User.create(userDto);
    res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu.' });
  } catch (error) {
    console.error('Failed to create user: ', error);
    res.status(500).json({ error: 'Kullanıcı oluşturulurken bir hata ile karşılaşıldı.' });
  }
};

export const patchUser = async (req: Request, res: Response) => {
  try {
    const userId = parseId(req.params.id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const [updatedRows] = await User.update(
      {
        ...req.body,
      },
      {
        where: { id: userId },
      },
    );

    if (updatedRows === 0) {
      res.status(404).json({ error: userNotFoundMessage });
      return;
    }

    res.status(200).json({ message: 'Kullanıcı güncellendi.' });
  } catch (error) {
    console.error('Failed to patch user: ', error);
    res.status(500).json({ error: 'Kullanıcı düzenlenirken bir hata ile karşılaşıldı.' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await fetchUserById(req, res);
    if (!user) return;

    await User.destroy({
      where: { id: user.id },
    });
  } catch (error) {
    console.error('Failed to delete user: ', error);
    res.status(500).json({ error: 'Kullanıcı silinirken bir hata ile karşılaşıldı.' });
  }
};

export const deleteUsers = async (req: Request, res: Response) => {
  try {
    const { ids }: { ids: string[] } = req.body;

    if (!ids || ids.length === 0) {
      res.status(400).json({ error: "Kullanici ID'leri gereklidir." });
      return;
    }

    const invalidIds = ids.filter((id) => isNaN(Number(id)));
    if (invalidIds.length > 0) {
      res.status(400).json({ error: "Geçersiz ID'ler sağlandı." });
      return;
    }

    const deletedRows = await User.destroy({
      where: { id: ids },
    });

    if (deletedRows === 0) {
      res.status(404).json({ error: userNotFoundMessage });
      return;
    }

    res.status(200).json({ message: 'Silme operasyonu hatasız geçti', deletedRows });
  } catch (error) {
    console.error('An error occurred while deleting users: ', error);
    res.status(500).json({ error: 'Kullanıcılar silinirken bir hata ile karşılaşıldı.' });
  }
};
