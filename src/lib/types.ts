export interface Source {
  url: string
  title: string
}

export interface ConversationResponse {
  id: string
  round: number
  model: string
  content: string
  sources?: Source[]
}

export interface Conversation {
  id: string
  createdAt: string
  rawInput: string
  augmentedPrompt: string
  topicType: string
  framework: string
  models: string[]
  responses: ConversationResponse[]
}

export interface SSEEvent {
  event: string
  data: {
    round?: number
    model?: string
    modelName?: string
    content?: string
    conversationId?: string
    message?: string
  }
}
