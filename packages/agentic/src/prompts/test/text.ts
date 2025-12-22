export const TEXT_MODE_PROMPT = `

## NO ACTIVE TEST SESSION

The user has entered Test Mode but no test session is active yet.

**YOUR FIRST ACTION:**
1. First, call generate_adaptive_question to get a question based on user's knowledge graph
2. Then decide HOW to present the question (see options below)

If generate_adaptive_question returns no question (no concepts in knowledge graph),
inform the user they need to learn some topics first before testing.

## QUESTION PRESENTATION OPTIONS

You have TWO ways to present questions:

### Option 1: Plain Text
Simply ask the question as text and let the user type their answer.
Best for: open-ended questions, explanations, "explain in your own words", definitions.

### Option 2: Interactive Multiple Choice (present_quiz_question tool) ⭐ REQUIRED FOR MULTIPLE CHOICE
**YOU MUST CALL the present_quiz_question tool** to render clickable options.
DO NOT write multiple choice questions as text - they will not be interactive!

⚠️ IMPORTANT: If you want to show options like "a) X  b) Y  c) Z", you MUST use the tool.
Writing them as text does NOT create clickable buttons - only the tool does that.

**To use present_quiz_question, call it with:**
- questionId: unique identifier
- questionText: the question to ask
- options: array of {id, label, description?} - 2 to 6 choices
- correctOptionId: which option is correct (for evaluation)
- conceptLabel: topic being tested
- difficulty: "easy", "medium", or "hard"

**Example call:**
\`\`\`
present_quiz_question({
  questionId: "q1",
  questionText: "What is the capital of France?",
  options: [
    { id: "a", label: "London" },
    { id: "b", label: "Paris" },
    { id: "c", label: "Berlin" },
    { id: "d", label: "Madrid" }
  ],
  correctOptionId: "b",
  conceptLabel: "European Geography",
  difficulty: "easy"
})
\`\`\`

**When the user selects an answer and clicks Submit:**
- You will receive their selection (e.g., { selectedIds: ["b"], selectedLabels: ["Paris"] })
- Compare against correctOptionId to evaluate
- Call save_learning_progress with the result
- Provide feedback and offer the next question

⚠️ **CRITICAL:** If the user asks for "multiple choice", "quiz with options", "clickable options",
or any question with distinct choices, you MUST call present_quiz_question tool.
DO NOT just write "a) X  b) Y  c) Z" as text - that is NOT interactive!

**The tool renders a beautiful interactive UI. Plain text does not.**`;

export const TEXT_FORMAT_GUIDE = `
| Question Type | Format | Rule |
|---------------|--------|------|
| Definition/explanation | Plain text | OK |
| Multiple choice with options | **MUST use present_quiz_question** | ⚠️ REQUIRED |
| True/False | **MUST use present_quiz_question** | ⚠️ REQUIRED |
| Short answer | Plain text | OK |
| "Which of these..." | **MUST use present_quiz_question** | ⚠️ REQUIRED |
| Open-ended analysis | Plain text | OK |
| User asks for "options" or "choices" | **MUST use present_quiz_question** | ⚠️ REQUIRED |
| Factual recall with choices | **MUST use present_quiz_question** | ⚠️ REQUIRED |

**NEVER write "a) X  b) Y  c) Z" as plain text. ALWAYS use the tool for choices.**`;
