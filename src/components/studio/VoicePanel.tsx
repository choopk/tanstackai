import { useState } from 'react'
import { Loader2, Mic, MicOff, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { Streamdown } from 'streamdown'

import { useStudioChat } from '#/lib/demo-ai-hook'
import { useAudioRecorder } from '#/hooks/demo-useAudioRecorder'
import { useTTS } from '#/hooks/demo-useTTS'

import HowItWorks from './HowItWorks'

export default function VoicePanel() {
  const [transcript, setTranscript] = useState('')
  const { isRecording, isTranscribing, startRecording, stopRecording } =
    useAudioRecorder()
  const { playingId, speak, stop: stopTTS } = useTTS()

  const { messages, sendMessage, isLoading } = useStudioChat()

  const handleMicClick = async () => {
    if (isRecording) {
      const text = await stopRecording()
      if (text) setTranscript(text)
    } else {
      await startRecording()
    }
  }

  // Latest assistant reply = current insights
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant')
  const insights =
    (lastAssistant?.parts.find(
      (p): p is Extract<typeof p, { type: 'text' }> =>
        p.type === 'text' && !!p.content,
    )?.content as string) ?? ''

  const getInsights = () => {
    if (!transcript.trim()) return
    sendMessage(
      `Here is a transcript of a client voice note:\n\n"""\n${transcript}\n"""\n\nSummarize it and list the concrete action items as a short bullet list.`,
    )
  }

  return (
    <div>
      <p className="demo-muted mb-4 max-w-2xl">
        Record a voice note, transcribe it with speech-to-text, then let the AI
        extract insights — and read the answer aloud. This exact pipeline powers
        "AI meeting notes" services.
      </p>

      <div className="demo-card space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleMicClick}
            disabled={isTranscribing}
            className={`demo-button px-4 py-2 ${
              isRecording ? 'demo-button-danger' : 'demo-button-secondary'
            } disabled:opacity-50`}
          >
            {isTranscribing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transcribing...
              </>
            ) : isRecording ? (
              <>
                <MicOff className="mr-2 h-4 w-4" />
                Stop &amp; Transcribe
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Record Voice Note
              </>
            )}
          </button>
          {isRecording && (
            <span className="flex items-center gap-1.5 text-xs demo-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Recording...
            </span>
          )}
          <button
            onClick={getInsights}
            disabled={!transcript.trim() || isLoading}
            className="demo-button ml-auto px-4 py-2 text-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Get Insights
              </>
            )}
          </button>
        </div>

        {transcript ? (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide demo-muted">
                Transcript
              </span>
              <button
                onClick={() => setTranscript('')}
                className="text-xs demo-muted hover:text-[var(--sea-ink)]"
              >
                Clear
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              className="demo-textarea w-full text-sm"
              placeholder="Or paste/type a transcript here instead..."
            />
          </div>
        ) : (
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
            className="demo-textarea w-full text-sm"
            placeholder="No recording yet — you can also paste or type a transcript directly."
          />
        )}
      </div>

      {(insights || isLoading) && (
        <div className="demo-card mt-4 p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--lagoon-deep)]">
              AI Insights
            </span>
            {insights && (
              <button
                onClick={() =>
                  playingId === 'insights'
                    ? stopTTS()
                    : speak(insights, 'insights')
                }
                className="demo-muted p-1 transition hover:text-[var(--lagoon-deep)]"
                title={playingId === 'insights' ? 'Stop' : 'Read aloud'}
              >
                {playingId === 'insights' ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
          {isLoading && !insights ? (
            <p className="flex items-center gap-2 text-sm demo-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
            </p>
          ) : (
            <div className="text-sm text-[var(--sea-ink)] [&_div]:max-w-none [&_*]:text-sm">
              <Streamdown>{insights}</Streamdown>
            </div>
          )}
        </div>
      )}

      <HowItWorks title="How this works: transcription + TTS">
        <ul className="list-disc space-y-2 pl-4">
          <li>
            The browser's MediaRecorder captures audio;{' '}
            <code>useAudioRecorder</code> posts it to the transcription endpoint,
            which wraps <code>generateTranscription()</code> (Whisper).
          </li>
          <li>
            The transcript is sent through the normal streaming{' '}
            <code>chat()</code> endpoint for analysis.
          </li>
          <li>
            <code>useTTS()</code> calls <code>generateSpeech()</code> server-side and
            plays base64 audio in the browser.
          </li>
          <li>
            Note: speech endpoints currently require an OpenAI API key.
          </li>
        </ul>
      </HowItWorks>
    </div>
  )
}
