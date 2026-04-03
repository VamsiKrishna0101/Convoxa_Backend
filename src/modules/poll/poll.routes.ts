import { Router } from "express";
import * as PollController from "./poll.controller.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/create", requireAuth, PollController.createPoll);
router.post("/vote", requireAuth, PollController.vote);

export default router;
