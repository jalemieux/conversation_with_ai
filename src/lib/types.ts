export interface Source {
  url: string
  title: string
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cost: number
}

export interface ConversationResponse {
  id: string
  round: number
  model: string
  content: string
  sources?: Source[]
  usage?: Usage
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
  isOwner?: boolean
}