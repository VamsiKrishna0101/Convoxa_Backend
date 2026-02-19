import { MessageType } from "../chat/chat.types.js"

// Re-export MessageType for consistency
export { MessageType }

export type GroupInput = {
    name: string,
    description: string,
    imageUrl?: string
}

export type GroupOutput = Readonly<{
    id: string,
    name: string,
    description: string | null,
    imageUrl?: string | null,
    inviteCode?: string,
    ownerId: string,
    createdAt: Date,
    lastMessage?: GroupMessageOutput | null,
    unreadCount?: number,
}>

export type MessageInput = {
    groupId: string,
    content?: string,
    type?: MessageType,
    mediaUrl?: string
}

export type MessageOutput = Readonly<{
    id: string,
    groupId: string,
    content: string,
    senderId: string,
    type: MessageType,
    mediaUrl?: string | null,
    createdAt: string,
}>

export type EditMessage = {
    messageId: string,
    content: string,
}

export type GetGroupMessagesInput = {
    groupId: string,
    cursor?: string,
    limit?: number
}

export type GroupMessageOutput = Readonly<{
    id: string,
    groupId: string,
    senderId: string,
    content: string,
    type: MessageType,
    mediaUrl?: string | null,
    createdAt: string,
    sender: {
        id: string,
        username: string
    }
}>