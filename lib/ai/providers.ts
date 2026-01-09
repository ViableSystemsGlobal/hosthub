/**
 * Multi-Provider AI Service
 * Supports OpenAI, Anthropic (Claude), and Google Gemini
 */

// Direct imports - packages should be installed
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

export type AIProvider = 'openai' | 'anthropic' | 'gemini'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  responseFormat?: { type: 'json_object' }
}

/**
 * Get AI configuration from settings or environment variables
 */
export async function getAIConfig(): Promise<AIConfig> {
  try {
    const { prisma } = await import('../prisma')
    
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['AI_PROVIDER', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'AI_MODEL'],
        },
      },
    })

    const settingsMap: Record<string, string> = {}
    settings.forEach((s) => {
      settingsMap[s.key] = s.value
    })

    const provider = (settingsMap.AI_PROVIDER || process.env.AI_PROVIDER || 'openai') as AIProvider
    const model = settingsMap.AI_MODEL || process.env.AI_MODEL

    let apiKey = ''
    switch (provider) {
      case 'openai':
        apiKey = settingsMap.OPENAI_API_KEY || process.env.OPENAI_API_KEY || ''
        break
      case 'anthropic':
        apiKey = settingsMap.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || ''
        break
      case 'gemini':
        apiKey = settingsMap.GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''
        break
    }

    if (!apiKey) {
      throw new Error(`API key not configured for ${provider}. Please add it in Settings → AI Providers.`)
    }

    return {
      provider,
      apiKey,
      model,
    }
  } catch (error: any) {
    // If database query fails, fallback to environment variables
    if (error.message && error.message.includes('API key not configured')) {
      throw error
    }
    
    const provider = (process.env.AI_PROVIDER || 'openai') as AIProvider
    let apiKey = ''
    
    switch (provider) {
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY || ''
        break
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY || ''
        break
      case 'gemini':
        apiKey = process.env.GEMINI_API_KEY || ''
        break
    }

    if (!apiKey) {
      throw new Error(`API key not configured for ${provider}. Please add it in Settings → AI Providers.`)
    }

    return {
      provider,
      apiKey,
      model: process.env.AI_MODEL,
    }
  }
}

/**
 * Generate chat completion using the configured provider
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> {
  const config = await getAIConfig()
  const { provider, apiKey, model: defaultModel } = config
  const { model = defaultModel, temperature = 0.7, responseFormat } = options

  switch (provider) {
    case 'openai': {
      if (!OpenAI) {
        throw new Error('OpenAI package is not installed. Run: npm install openai')
      }
      const openai = new OpenAI({ apiKey })
      const selectedModel = model || 'gpt-4o-mini'
      
      try {
        const response = await openai.chat.completions.create({
          model: selectedModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })) as any,
          temperature,
          response_format: responseFormat,
        })
        return response.choices[0].message.content || ''
      } catch (error: any) {
        if (error.status === 401 || error.status === 403) {
          throw new Error(
            'OpenAI API key is invalid or expired. Please check your API key in Settings → AI Providers.'
          )
        }
        if (error.status === 404 || (error.message && error.message.includes('model'))) {
          throw new Error(
            `Invalid OpenAI model: "${selectedModel}". Please check your model name in Settings → AI Providers. ` +
            `Common models: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo`
          )
        }
        throw error
      }
    }

    case 'anthropic': {
      if (!Anthropic) {
        throw new Error('Anthropic package is not installed. Run: npm install @anthropic-ai/sdk')
      }
      const anthropic = new Anthropic({ apiKey })
      // Separate system message from user messages
      const systemMessage = messages.find((m) => m.role === 'system')?.content || ''
      const userMessages = messages.filter((m) => m.role !== 'system')
      
      // Valid Anthropic models
      const validModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ]
      
      const selectedModel = model || 'claude-3-5-sonnet-20241022'
      
      // Validate model name
      if (!validModels.includes(selectedModel)) {
        throw new Error(
          `Invalid Anthropic model: "${selectedModel}". Valid models are: ${validModels.join(', ')}. ` +
          `Please update the model name in Settings → AI Providers or leave it empty to use the default.`
        )
      }
      
      try {
        const response = await anthropic.messages.create({
          model: selectedModel,
          max_tokens: 4096,
          system: systemMessage,
          messages: userMessages.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })) as any,
          temperature,
        })
        
        const content = response.content[0]
        if (content.type === 'text') {
          return content.text
        }
        throw new Error('Unexpected response format from Anthropic')
      } catch (error: any) {
        // Provide better error messages
        if (error.status === 401 || error.status === 403 || 
            (error.error?.type === 'authentication_error') ||
            (error.error?.message && error.error.message.includes('invalid x-api-key'))) {
          throw new Error(
            'Anthropic API key is invalid or expired. Please check your API key in Settings → AI Providers.'
          )
        }
        if (error.status === 404 && error.error?.message?.includes('model:')) {
          const invalidModel = error.error.message.match(/model: (\w+)/)?.[1] || selectedModel
          throw new Error(
            `Invalid Anthropic model: "${invalidModel}". Please check your model name in Settings → AI Providers. ` +
            `Valid models: ${validModels.join(', ')}`
          )
        }
        throw error
      }
    }

    case 'gemini': {
      if (!GoogleGenerativeAI) {
        throw new Error('Google Generative AI package is not installed. Run: npm install @google/generative-ai')
      }
      const genAI = new GoogleGenerativeAI(apiKey)
      const selectedModel = model || 'gemini-1.5-flash'
      
      try {
        const genModel = genAI.getGenerativeModel({ 
          model: selectedModel,
        })
        
        // Combine system and user messages
        const prompt = messages.map((m) => {
          if (m.role === 'system') {
            return `System: ${m.content}\n\n`
          }
          return `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}\n\n`
        }).join('')

        const result = await genModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            responseMimeType: responseFormat?.type === 'json_object' ? 'application/json' : undefined,
          },
        })

        const response = result.response
        return response.text()
      } catch (error: any) {
        if (error.status === 401 || error.status === 403 || 
            (error.message && error.message.includes('API key'))) {
          throw new Error(
            'Gemini API key is invalid or expired. Please check your API key in Settings → AI Providers.'
          )
        }
        if (error.message && error.message.includes('model')) {
          throw new Error(
            `Invalid Gemini model: "${selectedModel}". Please check your model name in Settings → AI Providers. ` +
            `Common models: gemini-1.5-flash, gemini-1.5-pro, gemini-pro`
          )
        }
        throw error
      }
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

