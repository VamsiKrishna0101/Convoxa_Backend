import { Server, Socket } from "socket.io";
import { ChatService } from "../modules/chat/chat.services";

export const chatSocket = (io: Server, socket: Socket) => {
    socket.on("join_conversation", (conversationId: string) => {
        socket.join(conversationId)
    })

    socket.on("send_message", async ({ conversationId, content, tempId }) => {
        const userId = socket.data.userId
        // Use provided tempId or fallback to server-generated one
        const messageTempId = tempId || `temp-${Date.now()}`

        // Create a temporary message object for instant delivery
        const tempMessage = {
            id: messageTempId,
            content,
            senderId: userId,
            conversationId,
            createdAt: new Date().toISOString()
        }
        // console.log(tempMessage)

        // Emit instantly to all participants in the conversation - REMOVED to avoid duplicate with service
        // io.to(conversationId).emit("receive_message", tempMessage)

        // Save to database
        try {
            const savedMessage = await ChatService.sendMessage({ conversationId, content }, userId)

            // Emit the real message ID so frontend can update tempId → realId
            socket.emit("message_saved", {
                tempId: messageTempId,
                realId: savedMessage.id,
                conversationId
            })
        } catch (error: any) {
            // Notify sender if save failed
            socket.emit("message_error", {
                tempId: messageTempId,
                error: error.message
            })
        }
    })
}