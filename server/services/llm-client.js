/**
 * LLM Client for OpenAI GPT-5.2 Responses API
 *
 * Uses environment variables for sensitive/environment-specific settings.
 * Uses config.json for non-sensitive settings (personas config).
 *
 * Environment Variables Used:
 *   OPENAI_API_KEY - Required API key
 *   LLM_MODEL - Model name (default: gpt-5.2)
 *   LLM_REASONING_EFFORT - Default reasoning effort (default: medium)
 *   LLM_VERBOSITY - Default verbosity (default: medium)
 *   LLM_MAX_TOKENS - Max output tokens (default: 4096)
 *
 * Reference: https://platform.openai.com/docs/guides/latest-model
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load non-sensitive config (personas settings only)
let personasConfig = {};
try {
  const config = JSON.parse(readFileSync(join(__dirname, '../../config/config.json'), 'utf-8'));
  personasConfig = config.personas || {};
} catch (error) {
  console.warn('Warning: Could not load config.json, using defaults');
}

/**
 * Reasoning effort levels for GPT-5.2:
 * - none: No reasoning tokens (fastest, cheapest)
 * - minimal: Very few reasoning tokens
 * - low: Light reasoning
 * - medium: Balanced (default)
 * - high: Deep reasoning
 * - xhigh: Maximum reasoning (GPT-5.2 only)
 */
const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];

export class LLMClient {
  constructor(options = {}) {
    // API key from environment (required)
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;

    if (!this.apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not set. Please create a .env file with your API key.\n' +
        'Copy .env.example to .env and add your key.'
      );
    }

    // Model settings from environment with fallbacks
    this.model = options.model || process.env.LLM_MODEL || 'gpt-5.2';
    this.maxTokens = options.maxTokens || parseInt(process.env.LLM_MAX_TOKENS, 10) || 4096;
    this.reasoningEffort = options.reasoningEffort || process.env.LLM_REASONING_EFFORT || 'medium';
    this.verbosity = options.verbosity || process.env.LLM_VERBOSITY || 'medium';
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';

    // Non-sensitive settings from config.json
    this.retryAttempts = personasConfig.retry_attempts || 3;
    this.reasoningOverrides = personasConfig.reasoning_overrides || {};
  }

  /**
   * Get reasoning effort for a specific persona, with fallback to default
   */
  getReasoningEffort(personaId) {
    return this.reasoningOverrides[personaId] || this.reasoningEffort;
  }

  /**
   * Make a completion request using the Responses API
   *
   * @param {string} instructions - System-level instructions
   * @param {string|Array} input - User message(s)
   * @param {Object} options - Additional options
   * @param {Object} options.jsonSchema - JSON schema for structured output
   * @param {string} options.reasoningEffort - Override reasoning effort
   * @param {string} options.verbosity - Override verbosity
   * @param {string} options.personaId - Persona ID for reasoning override lookup
   * @returns {Promise<Object>} - { parsed, raw, tokens }
   */
  async complete(instructions, input, options = {}) {
    const {
      jsonSchema = null,
      reasoningEffort = options.personaId
        ? this.getReasoningEffort(options.personaId)
        : this.reasoningEffort,
      verbosity = this.verbosity,
      includeReasoning = false
    } = options;

    // Build the request body for Responses API
    const body = {
      model: this.model,
      max_output_tokens: this.maxTokens,

      // Instructions replace the old "system" message
      instructions: instructions,

      // Input can be a string or array of message objects
      input: typeof input === 'string'
        ? [{ role: 'user', content: input }]
        : input,

      // Reasoning configuration
      reasoning: {
        effort: reasoningEffort,
        ...(includeReasoning && { summary: 'auto' })
      },

      // Verbosity control
      text: {
        verbosity: verbosity
      }
    };

    // Add structured output format if JSON schema provided
    if (jsonSchema) {
      body.text.format = {
        type: 'json_schema',
        strict: true,
        name: jsonSchema.name || 'response_schema',
        schema: jsonSchema.schema || jsonSchema
      };
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Responses API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return this.parseResponse(data, jsonSchema);
  }

  /**
   * Parse the Responses API response
   */
  parseResponse(data, expectJson = false) {
    // Use output_text helper if available, otherwise extract from output array
    let rawText = data.output_text || '';

    if (!rawText && data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text' || content.type === 'text') {
              rawText += content.text || '';
            }
          }
        }
      }
    }

    const tokens = {
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0,
      reasoning: data.usage?.output_tokens_details?.reasoning_tokens || 0,
      total: data.usage?.total_tokens || 0
    };

    let parsed = null;
    if (expectJson && rawText) {
      try {
        const jsonMatch = rawText.match(/```json\n?([\s\S]*?)\n?```/) ||
                          rawText.match(/```\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse JSON from response:', e.message);
      }
    }

    return { parsed, raw: rawText, tokens, responseId: data.id };
  }

  /**
   * Run multiple completions in parallel
   */
  async completeParallel(requests) {
    return Promise.all(
      requests.map(({ instructions, input, options }) =>
        this.complete(instructions, input, options)
      )
    );
  }

  /**
   * Complete with retry logic
   */
  async completeWithRetry(instructions, input, options = {}, maxRetries = null) {
    const retries = maxRetries ?? this.retryAttempts;
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.complete(instructions, input, options);
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt}/${retries} failed:`, error.message);

        if (error.message.includes('(4')) throw error; // Don't retry 4xx

        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    throw lastError;
  }
}

// Export a singleton instance getter (validates API key on first use)
let defaultClient = null;

export function getClient() {
  if (!defaultClient) {
    defaultClient = new LLMClient();
  }
  return defaultClient;
}

export default { LLMClient, getClient };
