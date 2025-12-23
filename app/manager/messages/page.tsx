'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { format } from 'date-fns'
import { MessageSquare, Send } from 'lucide-react'

interface Message {
  id: string
  senderType: string
  content: string
  createdAt: string
}

interface Conversation {
  id: string
  lastMessageAt: string
  messages: Message[]
  Owner?: {
    id: string
    name: string
    email: string
  }
}

export default function ManagerMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages()
      const interval = setInterval(fetchMessages, 5000) // Poll every 5 seconds
      return () => clearInterval(interval)
    }
  }, [selectedConversation])

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations')
      if (!res.ok) {
        throw new Error('Failed to fetch conversations')
      }
      const data = await res.json()
      
      // Ensure conversations is always an array
      const conversationsList = Array.isArray(data) ? data : []
      setConversations(conversationsList)
      
      if (conversationsList.length > 0 && !selectedConversation) {
        setSelectedConversation(conversationsList[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
      setConversations([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    if (!selectedConversation) return
    try {
      const res = await fetch(`/api/conversations/${selectedConversation}/messages`)
      if (!res.ok) {
        throw new Error('Failed to fetch messages')
      }
      const data = await res.json()
      // Ensure messages is always an array
      setMessages(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      setMessages([]) // Set empty array on error
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    try {
      const res = await fetch(`/api/conversations/${selectedConversation}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      })

      if (res.ok) {
        setNewMessage('')
        fetchMessages()
        fetchConversations() // Refresh to update last message time
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">Loading conversations...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentConversation = conversations.find(c => c.id === selectedConversation)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">
                  No conversations yet
                </p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedConversation === conv.id
                        ? 'bg-orange-50 border-orange-200'
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {conv.Owner?.name || 'Unknown Owner'}
                    </div>
                    {conv.messages && conv.messages.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {conv.messages[0].content}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {format(new Date(conv.lastMessageAt), 'MMM dd, yyyy')}
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              {currentConversation
                ? `Messages with ${currentConversation.Owner?.name || 'Owner'}`
                : 'Select a conversation'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedConversation ? (
              <div className="flex flex-col h-[600px]">
                {/* Messages List */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.senderType === 'owner' ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            message.senderType === 'owner'
                              ? 'bg-gray-100 text-gray-900'
                              : 'bg-orange-600 text-white'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              message.senderType === 'owner'
                                ? 'text-gray-500'
                                : 'text-orange-100'
                            }`}
                          >
                            {format(new Date(message.createdAt), 'MMM dd, hh:mm a')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Input */}
                <div className="border-t pt-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      placeholder="Type your message..."
                      rows={3}
                      className="resize-none"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Select a conversation to view messages</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
