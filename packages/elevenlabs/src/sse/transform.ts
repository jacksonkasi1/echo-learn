// ** import types
import type { SSEStreamChunk } from "../types/index.js";

/**
 * Default model identifier for SSE chunks
 */
const DEFAULT_MODEL = "echo-learn-v1";

/**
 * Generate a unique chunk ID
 */
function generateChunkId(): string {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create an SSE chunk object
 */
export function createSSEChunk(
  content: string,
  options?: {
    isFirst?: boolean;
    isFinal?: boolean;
    model?: string;
  },
): SSEStreamChunk {
  const { isFirst = false, isFinal = false, model = DEFAULT_MODEL } = options || {};

  return {
    id: generateChunkId(),
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {
          ...(isFirst ? { role: "assistant" } : {}),
          ...(content ? { content } : {}),
        },
        finish_reason: isFinal ? "stop" : null,
      },
    ],
  };
}

/**
 * Format an SSE chunk as a string for streaming
 */
export function formatSSEChunk(chunk: SSEStreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Format the SSE stream done signal
 */
export function formatSSEDone(): string {
  return "data: [DONE]\n\n";
}

/**
 * Create a text encoder for SSE streaming
 */
function getTextEncoder(): TextEncoder {
  return new TextEncoder();
}

/**
 * Transform a ReadableStream of Uint8Array chunks into SSE format
 * This converts plain text streaming into OpenAI-compatible SSE format
 */
export async function* transformToSSE(
  stream: ReadableStream<Uint8Array>,
  options?: {
    model?: string;
  },
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const { model = DEFAULT_MODEL } = options || {};

  let isFirst = true;
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Flush any remaining buffer
        if (buffer) {
          const chunk = createSSEChunk(buffer, { isFirst, model });
          yield formatSSEChunk(chunk);
          isFirst = false;
        }
        break;
      }

      // Decode the chunk
      const text = decoder.decode(value, { stream: true });
      buffer += text;

      // Emit chunks at natural boundaries (sentences, phrases)
      // This helps with TTS prosody
      const boundaries = [". ", "! ", "? ", ", ", ": ", "\n"];
      let lastBoundaryIndex = -1;

      for (const boundary of boundaries) {
        const index = buffer.lastIndexOf(boundary);
        if (index > lastBoundaryIndex) {
          lastBoundaryIndex = index + boundary.length;
        }
      }

      if (lastBoundaryIndex > 0) {
        const toEmit = buffer.substring(0, lastBoundaryIndex);
        buffer = buffer.substring(lastBoundaryIndex);

        const chunk = createSSEChunk(toEmit, { isFirst, model });
        yield formatSSEChunk(chunk);
        isFirst = false;
      }
    }

    // Send final chunk with finish_reason
    const finalChunk = createSSEChunk("", { isFinal: true, model });
    yield formatSSEChunk(finalChunk);

    // Send done signal
    yield formatSSEDone();
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create an SSE ReadableStream from an async generator
 */
export function createSSEStream(
  generator: AsyncGenerator<string, void, unknown>,
): ReadableStream<Uint8Array> {
  const encoder = getTextEncoder();

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await generator.next();

        if (done) {
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(value));
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Transform a text async iterable into an SSE stream
 */
export function textIterableToSSEStream(
  iterable: AsyncIterable<string>,
  options?: {
    model?: string;
  },
): ReadableStream<Uint8Array> {
  const encoder = getTextEncoder();
  const { model = DEFAULT_MODEL } = options || {};

  let isFirst = true;

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const text of iterable) {
          if (text) {
            const chunk = createSSEChunk(text, { isFirst, model });
            controller.enqueue(encoder.encode(formatSSEChunk(chunk)));
            isFirst = false;
          }
        }

        // Send final chunk
        const finalChunk = createSSEChunk("", { isFinal: true, model });
        controller.enqueue(encoder.encode(formatSSEChunk(finalChunk)));

        // Send done signal
        controller.enqueue(encoder.encode(formatSSEDone()));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
