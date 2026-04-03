import { Request, Response } from "express";
import { PollService } from "./poll.services.js";
import { PollInput, VoteInput } from "./poll.types.js";

export const createPoll = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const input: PollInput = req.body;
        
        const poll = await PollService.createPoll(input, userId);
        res.status(201).json({
            success: true,
            data: poll
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

export const vote = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const { pollId, optionId }: VoteInput = req.body;

        const voteResult = await PollService.vote(userId, pollId, optionId);
        res.status(200).json({
            success: true,
            data: voteResult
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
