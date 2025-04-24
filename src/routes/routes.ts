import { Router } from 'express';
import { getSample, postSample } from "../controllers/authController";

const router = Router();

router.get('/', getSample);
router.post('/', postSample);

export default router;