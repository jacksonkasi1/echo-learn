# Claude Development Notes

## Import Organization Style Guide

### Import Comment Categories

Always organize imports with proper comment headers and spacing:

```typescript
// ** import types
import type { TypeName, AnotherType } from '@/types/module'

// ** import utils
import { utilFunction } from 'wxt/utils/module'

// ** import lib
import { LibClass } from '@/lib/module'
import { AnotherClass } from './localModule'

// ** import apis
import { apiFunction } from '@/api/module'

// ** import constants
import { CONSTANT_VALUE } from './constants'

// ** import styles
import '@/entrypoints/style.css'
```

### Rules

1. **Always add 1 line space** between different import sections
2. **Use exact comment format**: `// ** import [category]`
3. **Group related imports** under the same comment section
4. **Order from abstract to concrete**: types → utils → lib → apis → constants → styles
5. **No additional descriptive text** in comments - just the category name

### Categories

- `// ** import types` - TypeScript type imports only
- `// ** import utils` - Utility functions and helpers  
- `// ** import lib` - Library/class imports from local modules
- `// ** import apis` - API-related imports
- `// ** import constants` - Constant/configuration imports
- `// ** import styles` - CSS/style imports

### Examples

✅ **Good:**
```typescript
// ** import types
import type { FormField } from '@/types/extension'

// ** import lib
import { ElementUtils } from './elementUtils'
import { SoundManager } from '@/lib/utils/soundManager'
```

❌ **Bad:**
```typescript
import type { FormField } from '@/types/extension'
import { ElementUtils } from './elementUtils'
import { SoundManager } from '@/lib/utils/soundManager'
```

❌ **Bad:**
```typescript
// ** import types
import type { FormField } from '@/types/extension'
// ** import lib utilities
import { ElementUtils } from './elementUtils'
```

This pattern ensures consistent, readable import organization across the entire codebase.

## Frontend API Architecture Guidelines

### Core Principles

1. **Separation of Concerns**: Keep API functions completely separate from React components
2. **Centralized Configuration**: Use a single axios instance configuration for all API calls
3. **Domain-Based Organization**: Group API functions by feature/domain in dedicated folders
4. **Single Source of Truth**: Centralize reusable UI configurations and shared resources
5. **Consistent File Structure**: Follow established patterns for predictable code organization

### API Function Organization

#### Structure Pattern
```
apps/admin-cms/src/api/
├── config/
│   └── axios.ts              # Centralized axios configuration
├── onboarding/
│   ├── signup.ts             # Onboarding-specific API calls
│   └── verification.ts
├── upload/
│   ├── get-signed-upload-url.ts
│   ├── delete-file.ts
│   └── index.ts              # Export all upload functions
└── products/
    ├── create-product.ts
    └── get-products.ts
```

#### API Function Template
```typescript
// ** import config
import axiosInstance from '@/config/axios';

// ** import types
import type { RequestType, ResponseType } from '@/types/feature';

/**
 * Brief description of what this API function does
 *
 * @param data - Description of input parameter
 * @returns Promise with response type
 */
export const functionName = async (
  data: RequestType
): Promise<ResponseType> => {
  const response = await axiosInstance.post<ResponseType>(
    '/endpoint',
    data
  );

  return response.data;
};
```

### File Upload Management

#### Upload Path Configuration
- **Central Configuration**: All upload destinations defined in `src/config/upload-paths.ts`
- **Path Consistency**: Use predefined constants instead of hardcoded strings
- **Feature-Based Paths**: Organize upload paths by application feature

```typescript
// ✅ Good: Using centralized upload paths
import { UPLOAD_PATHS } from '@/config/upload-paths';
const path = UPLOAD_PATHS.ONBOARDING.BANK_DOCUMENTS;

// ❌ Bad: Hardcoded upload paths
const path = 'bank-documents';
```

#### Upload API Organization
- **Dedicated Folder**: All upload-related APIs in `src/api/upload/`
- **Function Separation**: One API function per file for upload operations
- **Consistent Naming**: Use descriptive, action-based file names

### Reusable UI Configuration

#### Data Organization
```
apps/admin-cms/src/data/
├── dropdown-options.ts       # Global dropdown configurations
└── products/
    ├── status-options.ts     # Product-specific status options
    ├── category.ts           # Product categories
    └── index.ts              # Export all product data
```

#### Configuration Pattern
```typescript
// ** Centralized dropdown options
export interface StatusOption {
  value: string;
  label: string;
  color?: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'inactive', label: 'Inactive', color: 'red' }
];
```

### Component Integration Rules

#### API Usage in Components
```typescript
// ✅ Good: Import API functions, keep components clean
import { submitOnboardingSignup } from '@/api/onboarding/signup';
import { STATUS_OPTIONS } from '@/data/products/status-options';

const MyComponent = () => {
  const handleSubmit = async (data) => {
    try {
      const result = await submitOnboardingSignup(data);
      // Handle success
    } catch (error) {
      // Handle error
    }
  };
};

// ❌ Bad: Inline API calls in components
const MyComponent = () => {
  const handleSubmit = async (data) => {
    const response = await axios.post('/onboarding/signup', data);
  };
};
```

#### Benefits of This Architecture
- **Maintainability**: Easy to locate and update API logic
- **Reusability**: API functions can be shared across components
- **Testing**: API functions can be unit tested independently
- **Type Safety**: Centralized type definitions ensure consistency
- **Configuration Management**: Single source of truth for shared resources

### Quality Checklist

Before implementing new API functionality:
- [ ] API function is in appropriate domain folder
- [ ] Uses centralized axios configuration
- [ ] Follows established naming conventions
- [ ] Includes proper TypeScript types
- [ ] Upload paths use centralized configuration
- [ ] Reusable data is centralized in `/data` folder
- [ ] Component remains focused on UI logic only

## Code Splitting & File Organization Rules

### API Code Splitting

When API files become large or contain multiple endpoints, follow these splitting rules:

#### 1. Single Responsibility Principle
- **One API endpoint per file**
- **One schema per file** 
- Each file should handle exactly one operation

#### 2. Domain-Based Folder Structure
```
apps/gcr-server/src/routes/products/
├── brand/                     # Brand domain
│   ├── index.ts              # Domain router
│   ├── get-brands.ts         # GET /products/brands
│   └── get-brand-details.ts  # GET /products/brands/:id
├── org-defaults/             # Organization defaults domain
│   ├── index.ts
│   ├── get-colors.ts         # GET /products/org-colors
│   └── get-sizes.ts          # GET /products/org-sizes
└── product/                  # Product CRUD domain
    ├── index.ts
    ├── create-product.ts     # POST /products
    ├── get-products.ts       # GET /products
    └── update-product.ts     # PATCH /products/:id
```

#### 3. Schema Organization (Mirror API Structure)
```
apps/gcr-server/src/schema/products/
├── brand/
│   └── index.ts
├── org-defaults/
│   └── index.ts
└── product/
    ├── index.ts
    ├── create-product.schema.ts
    └── update-product.schema.ts
```

#### 4. File Naming Conventions
- Use **kebab-case** for file names
- Use **descriptive action-resource** naming:
  - `get-products.ts` - List products
  - `get-product-details.ts` - Single product
  - `create-product.ts` - Create product
  - `update-product-status.ts` - Update specific field
  - `bulk-delete-products.ts` - Bulk operations

#### 5. Index File Pattern
Each domain folder must have an `index.ts` that exports the domain router:

```typescript
// apps/gcr-server/src/routes/products/product/index.ts
import { Hono } from "hono";
import { createProductRoute } from "./create-product";
import { getProductsRoute } from "./get-products";

export const productRoutes = new Hono();
productRoutes.route("/", createProductRoute);
productRoutes.route("/", getProductsRoute);
```

#### 6. Main Router Integration
```typescript
// apps/gcr-server/src/routes/products/index.ts
import { Hono } from "hono";
import { productRoutes } from "./product";
import { brandRoutes } from "./brand";

const products = new Hono();
products.route("/", productRoutes);
products.route("/", brandRoutes);

export { products };
```

#### 7. Export Patterns
- **Individual files**: Export named route constants
- **Index files**: Export domain routers  
- **Schema files**: Export individual schemas
- **Schema index**: Re-export all schemas from domain

### When NOT to Split
- Files under 150 lines
- Single endpoint with minimal logic
- Tightly coupled operations that share significant logic

### Quality Checklist
Before splitting files, ensure:
- [ ] Each file has single responsibility
- [ ] Proper middleware usage maintained
- [ ] Import paths updated correctly
- [ ] Schema organization mirrors API structure
- [ ] Index files properly export routes
- [ ] TypeScript compilation passes
- [ ] Consistent naming conventions used

This organized approach ensures maintainable, scalable API development with clear separation of concerns.

---

## Backend (Hono.js) Architecture Guidelines
**Added:** 2025-12-19

### Core Principles

1. **Centralized Schema & Types**: All Zod schemas and TypeScript types live in dedicated folders
2. **Pure Logic Separation**: Business logic stays in `lib/` or `utils/`, not in route handlers
3. **Route Handlers**: Only handle HTTP logic (validation, calling lib functions, returning responses)
4. **File Size Limit**: Maximum 300 lines per file
5. **Single Responsibility**: Each file handles one specific concern

### Project Structure

```
apps/server/src/
├── schema/                    # 🔵 Centralized Zod validation schemas
│   ├── chat/
│   │   ├── completions.schema.ts
│   │   └── index.ts
│   ├── ingest/
│   │   ├── process.schema.ts
│   │   └── index.ts
│   └── upload/
│       ├── signed-url.schema.ts
│       └── index.ts
│
├── types/                     # 🔵 Centralized TypeScript types
│   ├── chat/
│   │   ├── messages.ts
│   │   └── index.ts
│   ├── ingest/
│   │   ├── document.ts
│   │   └── index.ts
│   └── common/
│       ├── api.ts
│       └── index.ts
│
├── lib/                       # 🟢 Pure business logic (reusable, non-HTTP)
│   ├── llm/
│   │   └── generate-response.ts
│   ├── rag/
│   │   └── retrieve-context.ts
│   ├── chunker/
│   │   └── text-chunker.ts
│   └── embedding/
│       └── gemini-embed.ts
│
├── utils/                     # 🟢 Utility helpers (pure functions)
│   ├── response.ts           # Standard response helpers
│   ├── crypto.ts             # Hashing, tokens
│   └── time.ts               # Date/time formatting
│
├── middleware/                # 🟡 HTTP middleware
│   ├── auth.ts               # Authentication
│   ├── error.ts              # Error handling
│   └── logger.ts             # Request logging
│
└── routes/                    # 🟠 API endpoint handlers
    ├── chat/
    │   ├── index.ts          # Router export
    │   └── completions.ts    # POST /chat/completions
    ├── ingest/
    │   ├── index.ts
    │   └── process.ts        # POST /ingest
    ├── upload/
    │   ├── index.ts
    │   └── get-signed-url.ts
    └── v1/
        └── ...
```

### File Organization Rules

#### 1. Schema Files (`src/schema/<entity>/<usage>.schema.ts`)

**Purpose**: Zod validation schemas for API requests/responses

**Naming Pattern**: `<action>-<resource>.schema.ts` or `<usage>.schema.ts`

**Example**:
```typescript
// src/schema/chat/completions.schema.ts

// ** import lib
import { z } from 'zod'

export const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
})

export const chatCompletionSchema = z.object({
  model: z.string().optional().default('echo-learn-v1'),
  messages: z.array(messageSchema).min(1),
  user_id: z.string().optional(),
  max_tokens: z.number().optional().default(1024),
  temperature: z.number().optional().default(0.7),
  stream: z.boolean().optional().default(false),
})

export type ChatCompletionRequest = z.infer<typeof chatCompletionSchema>
export type Message = z.infer<typeof messageSchema>
```

**Index Export**:
```typescript
// src/schema/chat/index.ts
export * from './completions.schema'
```

#### 2. Type Files (`src/types/<entity>/<name>.ts`)

**Purpose**: TypeScript interfaces and types

**Naming Pattern**: `<resource>.ts` or `<domain>.ts`

**Example**:
```typescript
// src/types/chat/messages.ts

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

export interface ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: ChatChoice[]
  usage: TokenUsage
}

export interface ChatChoice {
  index: number
  message: ChatMessage
  finish_reason: 'stop' | 'length' | 'content_filter'
}

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}
```

**Index Export**:
```typescript
// src/types/chat/index.ts
export * from './messages'
```

#### 3. Library Files (`src/lib/<domain>/<action>.ts`)

**Purpose**: Pure business logic, reusable functions (no HTTP concerns)

**Naming Pattern**: `<action>-<resource>.ts`

**Example**:
```typescript
// src/lib/llm/generate-response.ts

// ** import types
import type { ChatMessage } from '@/types/chat'

// ** import lib
import { Mistral } from '@mistralai/mistralai'

export interface GenerateResponseOptions {
  messages: ChatMessage[]
  maxTokens: number
  temperature: number
  systemPrompt?: string
}

/**
 * Generate LLM response from messages
 */
export const generateResponse = async (
  options: GenerateResponseOptions
): Promise<string> => {
  const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })
  
  const response = await client.chat.complete({
    model: 'mistral-large-latest',
    messages: options.messages,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  })
  
  return response.choices[0]?.message.content || ''
}
```

#### 4. Route Files (`src/routes/<entity>/<action>.ts`)

**Purpose**: HTTP endpoint handlers (import & use schema, types, lib)

**Naming Pattern**: `<action>-<resource>.ts` or just `<action>.ts`

**Example**:
```typescript
// src/routes/chat/completions.ts

// ** import types
import type { Context } from 'hono'
import type { ChatCompletionResponse } from '@/types/chat'

// ** import lib
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

// ** import schema
import { chatCompletionSchema } from '@/schema/chat'

// ** import utils
import { generateResponse } from '@/lib/llm/generate-response'
import { retrieveContext } from '@/lib/rag/retrieve-context'
import { logger } from '@repo/logs'

const chatRoute = new Hono()

/**
 * POST /chat/completions
 * OpenAI-compatible chat completions endpoint
 */
chatRoute.post(
  '/completions',
  zValidator('json', chatCompletionSchema),
  async (c: Context) => {
    const startTime = Date.now()

    try {
      // 1. Parse & validate (handled by zValidator)
      const body = c.req.valid('json')
      
      // 2. Extract data
      const messages = body.messages
      const userId = body.user_id || 'default'
      
      logger.info('Processing chat request', { userId })
      
      // 3. Call business logic from lib
      const context = await retrieveContext(messages[0].content, userId)
      const response = await generateResponse({
        messages,
        maxTokens: body.max_tokens,
        temperature: body.temperature,
      })
      
      // 4. Format response
      const result: ChatCompletionResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: response },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      }
      
      logger.info('Chat completed', { duration: Date.now() - startTime })
      return c.json(result)
      
    } catch (error) {
      logger.error('Chat error', { error })
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

export { chatRoute }
```

**Index Export (Router)**:
```typescript
// src/routes/chat/index.ts

// ** import lib
import { Hono } from 'hono'

// ** import routes
import { chatRoute } from './completions'

const chat = new Hono()
chat.route('/', chatRoute)

export { chat }
```

### File Splitting Guidelines

#### When to Split (File > 300 lines)

**Before** (Single large file):
```
routes/ingest/ingest.ts (345 lines) ❌
```

**After** (Split into focused files):
```
routes/ingest/
├── index.ts                  # Router only
├── process-pdf.ts            # PDF processing endpoint
└── process-text.ts           # Text processing endpoint

schema/ingest/
├── index.ts
├── process-pdf.schema.ts
└── process-text.schema.ts

lib/ingest/
├── pdf-processor.ts          # Pure PDF logic
└── text-processor.ts         # Pure text logic
```

#### Split Strategy

1. **Identify distinct operations** (different endpoints, HTTP methods, resources)
2. **Extract schemas** → `src/schema/<entity>/`
3. **Extract types** → `src/types/<entity>/`
4. **Extract pure logic** → `src/lib/<domain>/`
5. **Keep route handler minimal** → Only HTTP concerns

### Import Organization in Route Files

```typescript
// ** import types
import type { Context } from 'hono'
import type { ResponseType } from '@/types/entity'

// ** import lib
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

// ** import schema
import { requestSchema } from '@/schema/entity'

// ** import utils
import { businessLogicFunction } from '@/lib/domain/action'
import { helperFunction } from '@/utils/helpers'
import { logger } from '@repo/logs'
```

### Quality Checklist

Before committing new backend code:
- [ ] File is under 300 lines
- [ ] Schemas are in `src/schema/<entity>/`
- [ ] Types are in `src/types/<entity>/`
- [ ] Pure logic is in `src/lib/` or `src/utils/`
- [ ] Route handler only handles HTTP concerns
- [ ] Proper import organization with `// ** import` comments
- [ ] Each folder has `index.ts` for exports
- [ ] File naming uses kebab-case
- [ ] TypeScript compilation passes
- [ ] No business logic in route handlers

This architecture ensures maintainable, testable, and scalable Hono.js backend code.