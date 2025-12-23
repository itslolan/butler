# Todo Resolution - LLM-Driven Implementation

## Overview

The todo resolution system has been updated to rely entirely on the LLM calling the `resolve_todo` tool explicitly, rather than using client-side inference. This ensures consistent behavior and better tracking of todo resolutions.

## Changes Made

### 1. **Removed Client-Side Inference** (`components/ChatInterface.tsx`)

**Before:**
- Client would attempt to infer transaction type from user's text using regex patterns
- Would immediately call `/api/clarify-transaction` if a match was found
- This was unreliable and didn't always match user intent

**After:**
- Removed all client-side inference logic
- User's message goes directly to the LLM for processing
- LLM is responsible for understanding the user's intent and calling `resolve_todo`

```typescript
// REMOVED: ~40 lines of client-side inference code
// Now just: const userMessage = content.trim();
// No client-side inference - let LLM handle it via resolve_todo tool
```

### 2. **Enhanced System Context** (`components/ChatInterface.tsx`)

When a todo is shown to the user via `resolveTodo()`, the system message now includes explicit instructions for the LLM:

```typescript
**IMPORTANT INSTRUCTION FOR AI:**
Once the user provides an answer about this transaction type (income, expense, transfer, or other), 
you MUST call the \`resolve_todo\` tool with:
- todo_type: "transaction_clarification"
- todo_id: "${transaction.id}"
- action: "resolve"
- transaction_type: the appropriate type based on the user's answer

Do NOT simply acknowledge the answer - you MUST call the resolve_todo tool to actually resolve this item.
```

This context is embedded in every todo message, ensuring the LLM knows it must call the tool.

### 3. **Strengthened System Prompt** (`app/api/chat/route.ts`)

Updated the main system prompt to make todo resolution mandatory:

```markdown
**Transaction Clarification - MANDATORY WORKFLOW:**
- When a system message includes "TRANSACTION_ID: [uuid]", a TODO item is active and MUST be resolved
- Do NOT search for the transaction - the ID is already provided in the context
- After the user provides their answer about the transaction type:
  1. Determine the transaction type from their response (income, expense, transfer, or other)
  2. **YOU MUST IMMEDIATELY call resolve_todo** with:
     - todo_type: "transaction_clarification"
     - todo_id: [the transaction UUID from the system message]
     - action: "resolve"
     - transaction_type: [determined from user's answer]
  3. Do NOT just acknowledge - the resolve_todo tool call is REQUIRED
- CRITICAL: Every active transaction clarification MUST end with a resolve_todo call
```

### 4. **Updated Tool Descriptions** (`app/api/chat/route.ts`)

Reordered and clarified tool purposes:

**`resolve_todo` (Primary):**
```
REQUIRED: Resolve or dismiss a TODO item. For transaction clarifications, you MUST call this 
after the user answers. For account selections, call after user chooses an account. 
Use action="resolve" with required fields, or action="dismiss" to skip.
```

**`categorize_transaction` (Legacy/Fallback):**
```
Legacy tool for direct categorization
- Only use if NOT in a TODO workflow (no active TRANSACTION_ID in system message)
- For standalone categorization requests outside of TODO items
```

### 5. **Enhanced Callback Handling** (`components/ChatInterface.tsx`)

Added detection for `resolve_todo` tool calls in the streaming response handler:

```typescript
const hasTodoResolution = toolCalls.some(
  call => call.name === 'resolve_todo' && 
         call.result?.success === true && 
         (call.result?.resolved === true || call.result?.dismissed === true)
);

if ((hasCategorization || hasTodoResolution) && onTodoResolved) {
  console.log('[ChatInterface] Todo resolved, calling onTodoResolved callback');
  onTodoResolved();
}
```

This ensures the UI refreshes immediately after the LLM resolves a todo.

## How It Works Now

### User Flow:

1. **User sees a todo in the dashboard**
   - Todo panel shows transaction needing clarification

2. **User clicks "Ask AI" or navigates to chat**
   - `ChatInterface.resolveTodo()` is called
   - System message with instructions is added to chat
   - Message includes transaction details and explicit LLM instructions

3. **User types their answer**
   - Example: "This was for groceries"
   - Message is sent to LLM with full context

4. **LLM processes the message**
   - Reads system message with TRANSACTION_ID
   - Understands this is a todo workflow
   - Analyzes user's answer to determine transaction type
   - **Calls `resolve_todo` tool** with correct parameters

5. **Backend resolves the todo**
   - `/api/todos/resolve` is called
   - Sets `needs_clarification = false` in database
   - Returns success response

6. **UI updates automatically**
   - `hasTodoResolution` is detected in streaming response
   - `onTodoResolved()` callback triggers
   - Todo panel refreshes
   - Todo disappears from list ✅

## Benefits of This Approach

### ✅ **Reliability**
- No regex pattern matching that might miss valid answers
- LLM can understand natural language variations
- Consistent behavior across all cases

### ✅ **Auditability**
- Every resolution goes through the same code path
- Tool calls are logged in the LLM conversation
- Easy to debug when something goes wrong

### ✅ **Flexibility**
- LLM can ask clarifying questions if needed
- Can handle edge cases (e.g., "not sure" → mark as 'other')
- Can suggest alternative categories

### ✅ **Extensibility**
- Same pattern works for other todo types (account selection)
- Easy to add new todo workflows
- Clear separation of concerns

## Testing Checklist

- [ ] Answer with direct category (e.g., "food")
- [ ] Answer with natural language (e.g., "I bought groceries")
- [ ] Answer with unclear response (e.g., "not sure")
- [ ] Dismiss a todo without resolving
- [ ] Multiple todos in sequence
- [ ] Check that todo disappears after resolution
- [ ] Check that UI refreshes automatically
- [ ] Check console logs for tool calls

## Troubleshooting

### Todo doesn't disappear after LLM says it's resolved

1. **Check console logs:**
   ```
   [ChatInterface] Todo resolved, calling onTodoResolved callback
   ```
   If missing, the `resolve_todo` tool wasn't called

2. **Check LLM response:**
   - Look for tool call in the conversation
   - Verify tool call includes correct parameters
   - Check for `success: true` in tool result

3. **Check database:**
   ```sql
   SELECT needs_clarification, is_dismissed 
   FROM transactions 
   WHERE id = '<transaction-id>';
   ```
   Should be: `needs_clarification = false` AND `is_dismissed = false OR NULL`

### LLM doesn't call resolve_todo

- Check that system message includes "IMPORTANT INSTRUCTION FOR AI"
- Verify TRANSACTION_ID is in the message
- Check that system prompt includes mandatory workflow instructions
- Try regenerating response (LLM may have missed instruction)

### Tool call fails

- Check `/api/todos/resolve` logs
- Verify transaction exists in database
- Check that `transaction_type` is valid: income, expense, transfer, or other
- Verify user authentication

## Migration Notes

If you had old code that relied on client-side inference:
- Remove any manual calls to `/api/clarify-transaction`
- Remove `inferTransactionTypeFromText` usage
- Ensure todos use `resolveTodo()` method
- Test with various natural language inputs

## Future Improvements

1. Add timeout/fallback if LLM doesn't call tool within X seconds
2. Add explicit confirmation message when todo is resolved
3. Track resolution time metrics
4. Add bulk todo resolution support
5. Consider adding "resolve all" functionality

