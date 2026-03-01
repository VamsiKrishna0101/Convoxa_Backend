import { Server, Socket } from 'socket.io'
import { GroupService } from '../modules/groups/group.services.js'
import prisma from '../config/prisma.js'

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

    socket.on("group:send_message", async ({ groupId, content, tempId, username, imageUrl, isViewOnce }) => {
        if (!socket.data.groups?.has(groupId)) {
            return
        }

        const userId = socket.data.userId
        const messageTempId = tempId || `temp-${Date.now()}`

        try {
            const savedMessage = await GroupService.sendMessage({ groupId, content, imageUrl, isViewOnce }, userId)
            socket.emit("group:message_saved", {
                tempId: messageTempId,
                realId: savedMessage.id,
                groupId,
                createdAt: savedMessage.createdAt
            })
        } catch (error: any) {
            socket.emit("group:message_error", {
                tempId: messageTempId,
                error: error.message
            })
        }
    })


}