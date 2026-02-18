import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { groupSocket } from "./group.socket";

export const initSocket = (io: Server) => {
    io.on("connection", (socket) => {
        const userId = socket.data.userId;
        // console.log("New socket connected", socket.id, "for user", userId)

        // Join a private room for online status tracking
        if (userId) {
            socket.join(`user:${userId}`);
        }

        chatSocket(io, socket)
        groupSocket(io, socket)
        socket.on("disconnect", () => {
            // console.log("Socket disconnected", socket.id)
        })
    })
}