import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { getSession, login, logout, refresh, registerCompany } from './auth.controller.js';
import { companyRegistrationSchema, loginSchema, refreshTokenSchema } from './auth.schema.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshTokenSchema }), refresh);
router.post('/logout', authenticate, logout);
router.get('/session', authenticate, getSession);
router.post('/company-registration', validate({ body: companyRegistrationSchema }), registerCompany);

export default router;
