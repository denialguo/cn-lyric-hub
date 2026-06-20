# /component — Scaffold a New Component

Generate a new React component for CN Lyric Hub following project conventions.

## Usage

The user will say `/component ComponentName` or describe what they need. Create the component file at `src/components/ComponentName.jsx`.

## Conventions to Follow

### Structure
- Functional components with arrow functions: `const ComponentName = ({ props }) => { ... }`
- Default export at bottom: `export default ComponentName;`
- No TypeScript — this project uses plain JSX
- No PropTypes — the codebase doesn't use them

### Styling
- Tailwind CSS only, no CSS modules or styled-components
- Dark-mode-first: use `bg-slate-950`, `bg-slate-900`, `text-slate-200`, `text-white` as base colors
- Borders: `border border-slate-800` or `border-white/5`
- Cards: `bg-slate-900 border border-slate-800 rounded-2xl`
- Accent color: use `text-primary`, `bg-primary`, `border-primary` (CSS variable, not hardcoded)
- Hover states: `hover:bg-white/10`, `hover:text-white`, `hover:border-primary`
- Transitions: `transition-colors`, `transition-all`
- No hardcoded colors for the accent — always use the `primary` CSS variable class

### Icons
- Import from `lucide-react`: `import { IconName } from 'lucide-react'`
- Use `size={N}` prop, not className for sizing
- Common pattern: `<IconName size={16} />` inline with text

### State & Data
- Supabase client: `import { supabase } from '../lib/supabaseClient'`
- Auth: `import { useAuth } from '../context/AuthContext'` → `const { user, profile, ensureUser } = useAuth()`
- Theme: `import { useTheme } from '../context/ThemeContext'` → `const { scriptMode, isDarkMode, accentColor } = useTheme()`
- Toasts: `import { useToast } from '../context/ToastContext'` → `const { toast, confirm } = useToast()`
- Navigation: `import { useNavigate } from 'react-router-dom'` → `const navigate = useNavigate()`

### Do NOT
- Add comments unless the WHY is non-obvious
- Use `alert()` or `window.confirm()` — use `toast` and `confirm` from ToastContext
- Use `window.location.reload()` — use React state
- Show "No translation available" anywhere
- Sign in anonymously eagerly — use `ensureUser()` on interaction
- Add PropTypes, TypeScript, or JSDoc
- Create wrapper/HOC abstractions — keep it flat

### Missing Cover Pattern
When displaying cover images, always handle the missing case:
```jsx
{coverUrl ? (
  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
) : (
  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
    <Music className="w-8 h-8 text-slate-600" />
  </div>
)}
```

### Script Conversion Pattern
When displaying Chinese text that should respect the user's script preference:
```jsx
import { tify, sify } from 'chinese-conv';
import { useTheme } from '../context/ThemeContext';

const { scriptMode } = useTheme();
const displayText = scriptMode === 'traditional' ? tify(rawText) : sify(rawText);
```

## Process
1. Ask what the component should do if the user's description is vague
2. Create the file at `src/components/ComponentName.jsx`
3. Follow all conventions above
4. If the component needs to be added to a page, mention which file to update but don't modify it without asking
