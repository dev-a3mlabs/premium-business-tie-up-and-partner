import { Router } from 'express';
import adminRoutes from '../modules/admin/v1/admin.index.js';
import authRoutes from '../modules/auth/v1/auth.index.js';
import companyRoutes from '../modules/company/v1/company.index.js';
import contactRoutes from '../modules/contact/v1/contact.index.js';

const router = Router();

router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/company/:orgId', companyRoutes);
router.use('/contact', contactRoutes);

export default router;
