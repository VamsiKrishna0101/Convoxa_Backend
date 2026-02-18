import { Router } from 'express';
import { HelpController } from './help.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

// Submit help request (Protected or Public? User asked to ask email, so likely public-friendly but can be protected)
router.post('/submit', requireAuth, HelpController.submitHelpRequest);

// My requests
router.get('/my-requests', requireAuth, HelpController.getMyHelpRequests);

// List requests (Admin only - for now just protected)
router.get('/', requireAuth, HelpController.getHelpRequests);

export default router;
