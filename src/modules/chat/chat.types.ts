export enum MessageType {
    TEXT = "TEXT",
    IMAGE = "IMAGE",
    VIDEO = "VIDEO",
    AUDIO = "AUDIO",
    FILE = "FILE"
}

export enum MessageStatus {
    SENT = "SENT",
    DELIVERED = "DELIVERED",
    READ = "READ"
}

export type ConversationInput = {
    targetUserId: string
}

export type MessageInput = {
    content?: string // Optional for media
    conversationId?: string
    targetUserId?: string
    type?: MessageType
    mediaUrl?: string
    tempId?: string // Optimistic Update ID
}

export type MessageOutput = Readonly<{
    id: string
    content: string
    senderId: string
    conversationId: string
    type: MessageType
    mediaUrl?: string | null
    status: MessageStatus
    createdAt: string
    tempId?: string // Return it back for client matching
    sender?: {
        id: string
        username: string
    }
}>

export type GetMessagesInput = {
    conversationId: string
    cursor?: string // ID of the last message
    limit?: number
}

export type DeleteMessageInput = {
    messageId: string
    conversationId: string
}

export type EditMessageInput = {
    messageId: string
    conversationId: string
    content: string
}