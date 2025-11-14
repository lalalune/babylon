/**
 * JSON-RPC Type Definitions
 * 
 * Proper types for JSON-RPC request/response handling
 */

import type { JsonValue } from './common';

/**
 * JSON-RPC request parameters
 */
export type JsonRpcParams = Record<string, JsonValue> | JsonValue[];

/**
 * JSON-RPC result value
 */
export type JsonRpcResult = JsonValue | Record<string, JsonValue> | JsonValue[];

/**
 * Pending request handler
 */
export interface PendingRequest {
  resolve: (value: JsonRpcResult) => void;
  reject: (reason: Error) => void;
}

/**
 * Coalition message content types
 */
export type CoalitionMessageContent = 
  | { type: 'analysis'; data: Record<string, JsonValue> }
  | { type: 'vote'; data: { proposal: string; vote: 'yes' | 'no' } }
  | { type: 'action'; data: { action: string; params: Record<string, JsonValue> } }
  | { type: 'coordination'; data: { message: string; metadata?: Record<string, JsonValue> } };

