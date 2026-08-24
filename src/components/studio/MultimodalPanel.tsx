import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Send, X } from 'lucide-react'
import { Streamdown } from 'streamdown'
import {
  createChatClientOptions,
  fetchServerSentEvents,
  useChat,
} from '@tanstack/ai-react'
import type { ContentPart } from '@tanstack/ai'

import HowItWorks from './HowItWorks'

const visionChatOptions = createChatClientOptions({
  connection: fetchServerSentEvents('/demo/api/ai/chat'),
})

interface AttachedImage {
  dataUrl: string // full data: URL for preview
  base64: string // raw base64 payload for the API
  mimeType: string
}

export default function MultimodalPanel() {
  const [input, setInput] = useState('')
  const [images, setImages] = useState<Array<AttachedImage>>([])
  const { messages, sendMessage, isLoading } = useChat(visionChatOptions)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  const attach = (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files).slice(0, 3)) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result)
        setImages((prev) =>
          prev.length >= 3
            ? prev
            : [
                ...prev,
                {
                  dataUrl,
                  base64: dataUrl.split(',')[1] ?? '',
                  mimeType: file.type,
                },
              ],
        )
      }
      reader.readAsDataURL(file)
    }
  }

  const send = () => {
    if (isLoading || (!input.trim() && images.length === 0)) return

    const parts: Array<ContentPart> = []
    if (input.trim()) parts.push({ type: 'text', content: input.trim() })
    for (const img of images) {
      parts.push({
        type: 'image',
        source: { type: 'data', value: img.base64, mimeType: img.mimeType },
      })
    }

    // Multimodal send: a ContentPart array instead of a plain string
    sendMessage({ content: parts })
    setInput('')
    setImages([])
  }

  return (
    <div>
      <p className="demo-muted mb-4 max-w-2xl">
        Attach images — a menu, flyer, storefront photo — and ask the advisor to
        critique or work from them. Messages are sent as typed{' '}
        <strong>ContentPart arrays</strong> (text + image), not plain strings.
      </p>

      <div className="demo-card flex flex-col p-0" style={{ height: '480px' }}>
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto rounded-xl"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm demo-muted">
                Attach an image and try:
              </p>
              <div className="flex w-full max-w-md flex-col gap-2">
                {[
                  'Critique this flyer - would it convert?',
                  'Read this menu and suggest 3 AI automations for this restaurant',
                  'What kind of business is shown in this photo?',
                ].map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-2 text-xs text-[var(--sea-ink-soft)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`py-3 ${
                    message.role === 'assistant'
                      ? 'bg-[var(--chip-bg)]'
                      : 'bg-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2 px-2">
                    <div
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-xs font-medium text-white ${
                        message.role === 'assistant'
                          ? 'bg-[var(--lagoon-deep)]'
                          : 'bg-[var(--sea-ink-soft)]'
                      }`}
                    >
                      {message.role === 'assistant' ? 'AI' : 'Y'}
                    </div>
                    <div className="[&_div]:max-w-none min-w-0 flex-1 space-y-2 text-sm text-[var(--sea-ink)]">
                      {message.parts.map((part, i) => {
                        if (part.type === 'text' && part.content) {
                          return (
                            <Streamdown key={i}>{part.content}</Streamdown>
                          )
                        }
                        if (part.type === 'image') {
                          return (
                            <img
                              key={i}
                              src={
                                part.source.type === 'url'
                                  ? part.source.value
                                  : `data:${part.source.mimeType};base64,${part.source.value}`
                              }
                              alt="attached"
                              className="max-h-40 rounded-lg border border-[var(--line)]"
                            />
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {images.length > 0 && (
          <div className="flex gap-2 border-t border-[var(--line)] p-3">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img
                  src={img.dataUrl}
                  alt={`attach-${i}`}
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <button
                  onClick={() =>
                    setImages((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="border-t border-[var(--line)] p-3"
        >
          <div className="flex items-end gap-2">
            <label className="demo-button demo-button-secondary cursor-pointer p-3">
              <ImagePlus className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => attach(e.target.files)}
              />
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                images.length > 0
                  ? 'Ask about the attached image(s)...'
                  : 'Type a message, or attach an image first...'
              }
              className="demo-textarea flex-1 pr-3 text-sm"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && images.length === 0)}
              className="demo-button p-3 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      <HowItWorks title="How this works: multimodal content">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            Instead of <code>sendMessage('text')</code>, pass{' '}
            <code>sendMessage({'{ content: [textPart, imagePart] }'})</code> — a{' '}
            <code>ContentPart</code> array.
          </li>
          <li>
            Images travel as{' '}
            <code>{"{ type: 'image', source: { type: 'data', value, mimeType } }"}</code>{' '}
            (base64) or <code>{"{ type: 'url', value }"}</code>.
          </li>
          <li>
            The framework serializes parts into each provider's native vision
            format; incoming image parts render the same way you sent them.
          </li>
          <li>
            TanStack AI also supports <code>audio</code>, <code>video</code> and{' '}
            <code>document</code> content parts.
          </li>
        </ul>
      </HowItWorks>
    </div>
  )
}
