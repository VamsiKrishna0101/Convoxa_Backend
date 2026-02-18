import { Server, Socket } from 'socket.io'
import { GroupService } from '../modules/groups/group.services'
import prisma from '../config/prisma'

export const groupSocket = (io: Server, socket: Socket) => {
    socket.on("group:join", async (groupId: string) => {
        try {
            const member = await prisma.groupParticipant.findUnique({
                where: {
                    groupId_userId: {
                        groupId,
                        userId: socket.data.userId
                    }
                }
            })
            if (!member) return
            socket.join(groupId)
            socket.data.groups = socket.data.groups || new Set()
            socket.data.groups.add(groupId)
        } catch (error) {
            console.error(error)
        }
    })

    socket.on("group:send_message", async ({ groupId, content, tempId, username }) => {
        // Validate membership (optional double check, or trust the room join)
        // Since we check on join, we can assume if they are in the room they are allowed, 
        // but checking `socket.data.groups` is safer.
        if (!socket.data.groups?.has(groupId)) {
            // Attempt auto-join or reject? Rejecting for now to enforce join flow.
            // Actually, let's be lenient and re-check DB if not in set? 
            // For now, strict check matches user intent.
            // Using ?. because groups might be undefined if join wasn't called/failed
            return
        }

        const userId = socket.data.userId
        const messageTempId = tempId || `temp-${Date.now()}`
        const tempMessage = {
            id: messageTempId,
            groupId: groupId,
            senderId: userId,
            content,
            username,
            createdAt: new Date().toISOString()
        }

        // Optimistic update to everyone in the group - REMOVED -> Service emits "receive_group_message"
        // io.to(groupId).emit("group:new_message", tempMessage)

        try {
            const savedMessage = await GroupService.sendMessage({ groupId, content }, userId)

            // Confirm save to sender so they can replace tempId
            socket.emit("group:message_saved", {
                tempId: messageTempId,
                realId: savedMessage.id,
                groupId,
                createdAt: savedMessage.createdAt
            })
        } catch (error: any) {
            // Notify sender of failure
            socket.emit("group:message_error", {
                tempId: messageTempId,
                error: error.message
            })
        }
    })


}