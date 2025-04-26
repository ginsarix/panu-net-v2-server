import { Router } from 'express';
import { getSample, postSample } from "../controllers/testController.ts";
import { createUser, deleteUser, deleteUsers, getUser, getUsers, patchUser } from '../controllers/usersController.ts';

const router = Router();

const testRoute = '/test';
const usersRoute = '/users';

router.get(testRoute, getSample);
router.post(testRoute, postSample);

router.get(usersRoute, getUsers);
router.get(usersRoute + '/:id', getUser);
router.post(usersRoute, createUser);
router.patch(usersRoute + '/:id', patchUser)
router.delete(usersRoute + '/:id', deleteUser);
router.delete(usersRoute, deleteUsers);


export default router;