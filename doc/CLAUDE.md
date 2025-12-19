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