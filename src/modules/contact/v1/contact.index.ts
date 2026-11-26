import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { submitContact } from './contact.controller.js';
import { contactSchema } from './contact.schema.js';

const router = Router();

router.post('/', validate({ body: contactSchema }), submitContact);

export default router;
