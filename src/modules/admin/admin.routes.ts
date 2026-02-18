import express from 'express'
import { requireAuth } from '../../middlewares/auth.middleware'
import { getAdminCommunities, makeMod, getMembersOfCommunity, getAllFlaggedThreadsOfCommunity, getAllReportsOfCommunity } from './admin.controller'

const router = express.Router()

router.get("/communities", requireAuth, getAdminCommunities);
router.post("/make-mod", requireAuth, makeMod);
router.get("/members/:communityId", requireAuth, getMembersOfCommunity);
router.get("/flagged-threads/:communityId", requireAuth, getAllFlaggedThreadsOfCommunity);
router.get("/reports/:communityId", requireAuth, getAllReportsOfCommunity);

export default router;

