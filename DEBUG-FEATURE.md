# 🔍 Debug Panel Feature

## What's New

Added a **Cursor-style debug panel** to the chat interface that shows:
- 🔧 Function calls made by the LLM
- 📊 Arguments passed to each function
- ✅ Results returned from each function
- ⏱️ Execution time for each call
- 📈 Result counts (for arrays)

## How It Works

### Backend (API)
The chat API now tracks all function calls and returns debug information:

```typescript
{
  message: "The LLM's response",
  debug: {
    functionCalls: [
      {
        function: "search_transactions",
        arguments: { startDate: "2025-08-01", endDate: "2025-08-12" },
        result: [...],
        duration: "45ms",
        resultCount: 15
      }
    ],
    totalCalls: 1
  }
}
```

### Frontend (UI)
Each assistant message now shows a collapsible debug section:

```
┌─────────────────────────────────────┐
│ Assistant Message                    │
│ "I found 15 transactions..."        │
└─────────────────────────────────────┘
  ▼ 🔧 Debug: 1 function call
  ┌───────────────────────────────────┐
  │ search_transactions  45ms → 15 results
  │ 
  │ ▼ Arguments
  │   {
  │     "startDate": "2025-08-01",
  │     "endDate": "2025-08-12"
  │   }
  │
  │ ▼ Result
  │   [
  │     { "date": "2025-08-12", ... },
  │     ...
  │   ]
  └───────────────────────────────────┘
```

## Benefits

### 1. **Easy Debugging**
See exactly what the LLM is doing:
- Which functions it calls
- What filters/arguments it uses
- What data it receives back

### 2. **Transparency**
Users can verify the LLM's reasoning:
- "Why didn't it find my transactions?"
- "What date range did it search?"
- "Did it use the right filters?"

### 3. **Development**
Quickly identify issues:
- Wrong function being called
- Incorrect arguments
- Empty results from database
- Performance bottlenecks

## Example Scenarios

### Scenario 1: No Results Found
**User asks:** "What did I spend in August 2025?"

**Debug shows:**
```
🔧 Debug: 1 function call
  search_transactions  23ms → 0 results
  Arguments:
    {
      "startDate": "2025-08-01",
      "endDate": "2025-08-31"
    }
  Result: []
```

**You can see:** The query is correct, but no data exists for that period.

### Scenario 2: Wrong Date Format
**User asks:** "Show transactions from last month"

**Debug shows:**
```
🔧 Debug: 1 function call
  search_transactions  12ms → 0 results
  Arguments:
    {
      "startDate": "last month"  ← Invalid format!
    }
  Result: []
```

**You can see:** The LLM passed an invalid date format.

### Scenario 3: Multiple Function Calls
**User asks:** "Compare my spending across all credit cards"

**Debug shows:**
```
🔧 Debug: 3 function calls
  search_documents  45ms → 3 results
  search_transactions  67ms → 124 results
  get_all_metadata  12ms → 1 result
```

**You can see:** The LLM made multiple queries to gather comprehensive data.

## UI Features

### Collapsible Sections
- Click "🔧 Debug: X function calls" to expand/collapse
- Click "Arguments" or "Result" to see details
- Keeps the chat clean while providing deep insights

### Visual Indicators
- 🔧 Tool icon for debug sections
- Function names in blue badges
- Execution time in gray
- Result counts for arrays
- Syntax-highlighted JSON

### Dark Mode Support
All debug panels support dark mode with appropriate colors.

## Usage Tips

1. **Always check debug info when results seem wrong**
   - Look at the arguments to see what the LLM searched for
   - Check the result count to see if data was found

2. **Use it to improve prompts**
   - If the LLM uses wrong filters, rephrase your question
   - Be more specific with dates, amounts, merchants

3. **Identify data issues**
   - Empty results might mean no data uploaded
   - Check if dates match your uploaded statements

4. **Performance monitoring**
   - See which queries are slow
   - Identify if multiple calls are needed

## Future Enhancements

Possible additions:
- Show LLM's internal reasoning/thoughts
- Add "Re-run with different parameters" button
- Export debug logs for analysis
- Show SQL queries generated
- Add performance metrics and graphs

