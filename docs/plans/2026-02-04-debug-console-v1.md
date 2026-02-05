# Happy Plugin v1.0 Debug Console Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome extension Debug Console for multi-terminal observation, input simulation, and AI-powered analysis.

**Architecture:** Chrome Extension (Manifest V3) with sidebar panel as main UI. Content script handles DOM interaction with target page. Background service worker manages state and API calls. All actions are preview-first, reversible, and logged.

**Tech Stack:** TypeScript, Chrome Extension Manifest V3, Vanilla CSS, Vite (build tool)

---

## Task 1: Initialize Project Structure

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "happy-plugin",
  "version": "1.0.0",
  "description": "Happy Plugin Debug Console for multi-terminal environments",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.260",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.4.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
```

**Step 5: Commit**

```bash
git add package.json tsconfig.json vite.config.ts .gitignore
git commit -m "chore: initialize project with TypeScript and Vite"
```

---

## Task 2: Create Chrome Extension Manifest

**Files:**
- Create: `src/manifest.json`
- Create: `public/icons/icon16.png` (placeholder)
- Create: `public/icons/icon48.png` (placeholder)
- Create: `public/icons/icon128.png` (placeholder)

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Happy Debug Console",
  "version": "1.0.0",
  "description": "Debug Console for Happy multi-terminal environments",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "sidePanel"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Step 2: Create placeholder icons**

Create simple colored PNG files (16x16, 48x48, 128x128) as placeholders. Can use any image editor or online tool.

**Step 3: Commit**

```bash
git add src/manifest.json public/icons/
git commit -m "feat: add Chrome Extension manifest v3"
```

---

## Task 3: Create Type Definitions

**Files:**
- Create: `src/types/session.ts`
- Create: `src/types/ai-judge.ts`
- Create: `src/types/messages.ts`

**Step 1: Create session types**

```typescript
// src/types/session.ts

export interface Session {
  sessionId: string;
  title: string;
  visible: boolean;
  domSelector: string;
}

export interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  lastScanTime: number | null;
}
```

**Step 2: Create AI Judge types**

```typescript
// src/types/ai-judge.ts

export type SessionRole = 'Advisor' | 'Executor' | 'Other';
export type SessionState = 'RUNNING' | 'WAITING_INPUT' | 'ERROR';

export interface AIJudgeInput {
  recent_text: string[];
  signals: Record<string, unknown>;
}

export interface AIJudgeOutput {
  role: SessionRole;
  state: SessionState;
  confidence: number;
}

export interface APIStatus {
  provider: 'minimax' | 'glm';
  connected: boolean;
  latency: number | null;
  error: string | null;
}
```

**Step 3: Create message types for extension communication**

```typescript
// src/types/messages.ts

export type MessageType =
  | 'SCAN_SESSIONS'
  | 'SCAN_SESSIONS_RESULT'
  | 'SWITCH_SESSION'
  | 'PREVIEW_INPUT'
  | 'CLEAR_PREVIEW'
  | 'HIGHLIGHT_SESSION'
  | 'GET_SESSION_OUTPUT'
  | 'SESSION_OUTPUT_RESULT';

export interface BaseMessage {
  type: MessageType;
}

export interface ScanSessionsMessage extends BaseMessage {
  type: 'SCAN_SESSIONS';
}

export interface ScanSessionsResultMessage extends BaseMessage {
  type: 'SCAN_SESSIONS_RESULT';
  sessions: import('./session').Session[];
}

export interface SwitchSessionMessage extends BaseMessage {
  type: 'SWITCH_SESSION';
  sessionId: string;
}

export interface PreviewInputMessage extends BaseMessage {
  type: 'PREVIEW_INPUT';
  sessionId: string;
  text: string;
}

export interface ClearPreviewMessage extends BaseMessage {
  type: 'CLEAR_PREVIEW';
  sessionId: string;
}

export interface HighlightSessionMessage extends BaseMessage {
  type: 'HIGHLIGHT_SESSION';
  sessionId: string;
  highlight: boolean;
}

export interface GetSessionOutputMessage extends BaseMessage {
  type: 'GET_SESSION_OUTPUT';
  sessionId: string;
  lines: number;
}

export interface SessionOutputResultMessage extends BaseMessage {
  type: 'SESSION_OUTPUT_RESULT';
  sessionId: string;
  output: string[];
}

export type Message =
  | ScanSessionsMessage
  | ScanSessionsResultMessage
  | SwitchSessionMessage
  | PreviewInputMessage
  | ClearPreviewMessage
  | HighlightSessionMessage
  | GetSessionOutputMessage
  | SessionOutputResultMessage;
```

**Step 4: Create index export**

```typescript
// src/types/index.ts

export * from './session';
export * from './ai-judge';
export * from './messages';
```

**Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 4: Create Content Script - Session Scanner

**Files:**
- Create: `src/content/content.ts`
- Create: `src/content/session-scanner.ts`
- Test: `src/content/__tests__/session-scanner.test.ts`

**Step 1: Write the failing test for session scanner**

```typescript
// src/content/__tests__/session-scanner.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionScanner } from '../session-scanner';

describe('SessionScanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find terminal elements with data-session-id attribute', () => {
    document.body.innerHTML = `
      <div data-session-id="session-1" data-title="Terminal 1"></div>
      <div data-session-id="session-2" data-title="Terminal 2"></div>
    `;

    const scanner = new SessionScanner();
    const sessions = scanner.scan();

    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe('session-1');
    expect(sessions[1].sessionId).toBe('session-2');
  });

  it('should detect visibility of sessions', () => {
    document.body.innerHTML = `
      <div data-session-id="visible" style="display: block;"></div>
      <div data-session-id="hidden" style="display: none;"></div>
    `;

    const scanner = new SessionScanner();
    const sessions = scanner.scan();

    expect(sessions.find(s => s.sessionId === 'visible')?.visible).toBe(true);
    expect(sessions.find(s => s.sessionId === 'hidden')?.visible).toBe(false);
  });

  it('should return empty array when no terminals found', () => {
    document.body.innerHTML = '<div>No terminals here</div>';

    const scanner = new SessionScanner();
    const sessions = scanner.scan();

    expect(sessions).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/__tests__/session-scanner.test.ts`
Expected: FAIL with "Cannot find module '../session-scanner'"

**Step 3: Write minimal implementation**

```typescript
// src/content/session-scanner.ts

import type { Session } from '../types';

export class SessionScanner {
  private selector: string;

  constructor(selector = '[data-session-id]') {
    this.selector = selector;
  }

  scan(): Session[] {
    const elements = document.querySelectorAll(this.selector);
    const sessions: Session[] = [];

    elements.forEach((element) => {
      const el = element as HTMLElement;
      const sessionId = el.dataset.sessionId;

      if (sessionId) {
        sessions.push({
          sessionId,
          title: el.dataset.title || `Session ${sessionId}`,
          visible: this.isVisible(el),
          domSelector: this.generateSelector(el),
        });
      }
    });

    return sessions;
  }

  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  private generateSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }
    if (element.dataset.sessionId) {
      return `[data-session-id="${element.dataset.sessionId}"]`;
    }
    return '';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/__tests__/session-scanner.test.ts`
Expected: PASS

**Step 5: Create content script entry point**

```typescript
// src/content/content.ts

import { SessionScanner } from './session-scanner';
import type { Message, Session } from '../types';

const scanner = new SessionScanner();

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  switch (message.type) {
    case 'SCAN_SESSIONS': {
      const sessions = scanner.scan();
      sendResponse({ type: 'SCAN_SESSIONS_RESULT', sessions });
      break;
    }
  }
  return true; // Keep channel open for async response
});

console.log('[Happy Debug] Content script loaded');
```

**Step 6: Commit**

```bash
git add src/content/
git commit -m "feat: add session scanner content script"
```

---

## Task 5: Create Content Script - Input Injector

**Files:**
- Create: `src/content/input-injector.ts`
- Modify: `src/content/content.ts`
- Test: `src/content/__tests__/input-injector.test.ts`

**Step 1: Write the failing test**

```typescript
// src/content/__tests__/input-injector.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { InputInjector } from '../input-injector';

describe('InputInjector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should preview text in input field without submitting', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session">
        <input type="text" class="terminal-input" />
      </div>
    `;

    const injector = new InputInjector();
    const result = injector.preview('test-session', 'test input');

    expect(result.success).toBe(true);
    const input = document.querySelector('.terminal-input') as HTMLInputElement;
    expect(input.value).toBe('test input');
  });

  it('should clear preview from input field', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session">
        <input type="text" class="terminal-input" value="existing" />
      </div>
    `;

    const injector = new InputInjector();
    injector.preview('test-session', 'test input');
    injector.clearPreview('test-session');

    const input = document.querySelector('.terminal-input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('should highlight session container', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session"></div>
    `;

    const injector = new InputInjector();
    injector.highlight('test-session', true);

    const container = document.querySelector('[data-session-id="test-session"]') as HTMLElement;
    expect(container.style.outline).toContain('2px solid');
  });

  it('should return error when session not found', () => {
    document.body.innerHTML = '<div></div>';

    const injector = new InputInjector();
    const result = injector.preview('non-existent', 'test');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/__tests__/input-injector.test.ts`
Expected: FAIL with "Cannot find module '../input-injector'"

**Step 3: Write minimal implementation**

```typescript
// src/content/input-injector.ts

export interface InjectionResult {
  success: boolean;
  error?: string;
  previousValue?: string;
}

export class InputInjector {
  private inputSelector: string;
  private previousValues: Map<string, string> = new Map();

  constructor(inputSelector = '.terminal-input, input[type="text"], textarea') {
    this.inputSelector = inputSelector;
  }

  preview(sessionId: string, text: string): InjectionResult {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!container) {
      return { success: false, error: `Session ${sessionId} not found` };
    }

    const input = container.querySelector(this.inputSelector) as HTMLInputElement | HTMLTextAreaElement;
    if (!input) {
      return { success: false, error: `Input field not found in session ${sessionId}` };
    }

    // Store previous value for rollback
    this.previousValues.set(sessionId, input.value);

    // Set preview value
    input.value = text;
    input.style.backgroundColor = '#fffbcc'; // Highlight preview

    return { success: true, previousValue: this.previousValues.get(sessionId) };
  }

  clearPreview(sessionId: string): InjectionResult {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!container) {
      return { success: false, error: `Session ${sessionId} not found` };
    }

    const input = container.querySelector(this.inputSelector) as HTMLInputElement | HTMLTextAreaElement;
    if (!input) {
      return { success: false, error: `Input field not found in session ${sessionId}` };
    }

    // Clear the input
    input.value = '';
    input.style.backgroundColor = '';

    return { success: true };
  }

  rollback(sessionId: string): InjectionResult {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!container) {
      return { success: false, error: `Session ${sessionId} not found` };
    }

    const input = container.querySelector(this.inputSelector) as HTMLInputElement | HTMLTextAreaElement;
    if (!input) {
      return { success: false, error: `Input field not found in session ${sessionId}` };
    }

    const previousValue = this.previousValues.get(sessionId) || '';
    input.value = previousValue;
    input.style.backgroundColor = '';

    return { success: true };
  }

  highlight(sessionId: string, enabled: boolean): InjectionResult {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`) as HTMLElement;
    if (!container) {
      return { success: false, error: `Session ${sessionId} not found` };
    }

    if (enabled) {
      container.style.outline = '2px solid #4CAF50';
      container.style.outlineOffset = '2px';
    } else {
      container.style.outline = '';
      container.style.outlineOffset = '';
    }

    return { success: true };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/__tests__/input-injector.test.ts`
Expected: PASS

**Step 5: Update content script to include input injector**

```typescript
// src/content/content.ts

import { SessionScanner } from './session-scanner';
import { InputInjector } from './input-injector';
import type { Message } from '../types';

const scanner = new SessionScanner();
const injector = new InputInjector();

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  switch (message.type) {
    case 'SCAN_SESSIONS': {
      const sessions = scanner.scan();
      sendResponse({ type: 'SCAN_SESSIONS_RESULT', sessions });
      break;
    }
    case 'PREVIEW_INPUT': {
      const result = injector.preview(message.sessionId, message.text);
      sendResponse(result);
      break;
    }
    case 'CLEAR_PREVIEW': {
      const result = injector.clearPreview(message.sessionId);
      sendResponse(result);
      break;
    }
    case 'HIGHLIGHT_SESSION': {
      const result = injector.highlight(message.sessionId, message.highlight);
      sendResponse(result);
      break;
    }
  }
  return true;
});

console.log('[Happy Debug] Content script loaded');
```

**Step 6: Commit**

```bash
git add src/content/
git commit -m "feat: add input injector with preview and rollback"
```

---

## Task 6: Create Content Script - Output Listener

**Files:**
- Create: `src/content/output-listener.ts`
- Modify: `src/content/content.ts`
- Test: `src/content/__tests__/output-listener.test.ts`

**Step 1: Write the failing test**

```typescript
// src/content/__tests__/output-listener.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { OutputListener } from '../output-listener';

describe('OutputListener', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should extract recent lines from session output', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session">
        <div class="terminal-output">
          <div>Line 1</div>
          <div>Line 2</div>
          <div>Line 3</div>
        </div>
      </div>
    `;

    const listener = new OutputListener();
    const lines = listener.getRecentOutput('test-session', 2);

    expect(lines).toHaveLength(2);
    expect(lines).toContain('Line 2');
    expect(lines).toContain('Line 3');
  });

  it('should return all lines if requested more than available', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session">
        <div class="terminal-output">
          <div>Only line</div>
        </div>
      </div>
    `;

    const listener = new OutputListener();
    const lines = listener.getRecentOutput('test-session', 10);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Only line');
  });

  it('should return empty array when session not found', () => {
    document.body.innerHTML = '<div></div>';

    const listener = new OutputListener();
    const lines = listener.getRecentOutput('non-existent', 5);

    expect(lines).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/content/__tests__/output-listener.test.ts`
Expected: FAIL with "Cannot find module '../output-listener'"

**Step 3: Write minimal implementation**

```typescript
// src/content/output-listener.ts

export class OutputListener {
  private outputSelector: string;

  constructor(outputSelector = '.terminal-output, .output, pre') {
    this.outputSelector = outputSelector;
  }

  getRecentOutput(sessionId: string, lineCount: number): string[] {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!container) {
      return [];
    }

    const outputElement = container.querySelector(this.outputSelector);
    if (!outputElement) {
      return [];
    }

    // Get all child elements or text content lines
    const children = outputElement.children;
    const lines: string[] = [];

    if (children.length > 0) {
      // Extract text from child elements
      for (let i = 0; i < children.length; i++) {
        const text = children[i].textContent?.trim();
        if (text) {
          lines.push(text);
        }
      }
    } else {
      // Fall back to splitting text content
      const text = outputElement.textContent || '';
      lines.push(...text.split('\n').map(l => l.trim()).filter(l => l));
    }

    // Return last N lines
    return lines.slice(-lineCount);
  }

  detectWaitingState(sessionId: string): { waiting: boolean; signals: Record<string, unknown> } {
    const recentLines = this.getRecentOutput(sessionId, 5);
    const lastLine = recentLines[recentLines.length - 1] || '';

    // Rule-based detection
    const waitingPatterns = [
      /\$\s*$/, // Shell prompt
      />\s*$/, // Generic prompt
      /:\s*$/, // Colon prompt
      /\?\s*$/, // Question prompt
      /input/i, // Input request
    ];

    const waiting = waitingPatterns.some(pattern => pattern.test(lastLine));

    return {
      waiting,
      signals: {
        lastLine,
        matchedPattern: waiting ? 'prompt_detected' : null,
        lineCount: recentLines.length,
      },
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/content/__tests__/output-listener.test.ts`
Expected: PASS

**Step 5: Update content script**

```typescript
// src/content/content.ts

import { SessionScanner } from './session-scanner';
import { InputInjector } from './input-injector';
import { OutputListener } from './output-listener';
import type { Message } from '../types';

const scanner = new SessionScanner();
const injector = new InputInjector();
const listener = new OutputListener();

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  switch (message.type) {
    case 'SCAN_SESSIONS': {
      const sessions = scanner.scan();
      sendResponse({ type: 'SCAN_SESSIONS_RESULT', sessions });
      break;
    }
    case 'PREVIEW_INPUT': {
      const result = injector.preview(message.sessionId, message.text);
      sendResponse(result);
      break;
    }
    case 'CLEAR_PREVIEW': {
      const result = injector.clearPreview(message.sessionId);
      sendResponse(result);
      break;
    }
    case 'HIGHLIGHT_SESSION': {
      const result = injector.highlight(message.sessionId, message.highlight);
      sendResponse(result);
      break;
    }
    case 'GET_SESSION_OUTPUT': {
      const output = listener.getRecentOutput(message.sessionId, message.lines);
      sendResponse({ type: 'SESSION_OUTPUT_RESULT', sessionId: message.sessionId, output });
      break;
    }
  }
  return true;
});

console.log('[Happy Debug] Content script loaded');
```

**Step 6: Commit**

```bash
git add src/content/
git commit -m "feat: add output listener for session monitoring"
```

---

## Task 7: Create Background Service Worker

**Files:**
- Create: `src/background/background.ts`
- Create: `src/background/state-manager.ts`
- Test: `src/background/__tests__/state-manager.test.ts`

**Step 1: Write the failing test**

```typescript
// src/background/__tests__/state-manager.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../state-manager';

describe('StateManager', () => {
  let manager: StateManager;

  beforeEach(() => {
    manager = new StateManager();
  });

  it('should store and retrieve sessions', () => {
    const sessions = [
      { sessionId: '1', title: 'Test', visible: true, domSelector: '[data-session-id="1"]' },
    ];

    manager.setSessions(sessions);

    expect(manager.getSessions()).toEqual(sessions);
  });

  it('should set and get active session', () => {
    manager.setActiveSession('session-1');

    expect(manager.getActiveSession()).toBe('session-1');
  });

  it('should track API status', () => {
    manager.setAPIStatus('minimax', { connected: true, latency: 100 });

    const status = manager.getAPIStatus('minimax');
    expect(status?.connected).toBe(true);
    expect(status?.latency).toBe(100);
  });

  it('should log actions', () => {
    manager.logAction('SCAN', { count: 3 });
    manager.logAction('PREVIEW', { text: 'test' });

    const logs = manager.getLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('SCAN');
  });

  it('should export snapshot', () => {
    manager.setSessions([{ sessionId: '1', title: 'T', visible: true, domSelector: '' }]);
    manager.setActiveSession('1');
    manager.logAction('TEST', {});

    const snapshot = manager.exportSnapshot();

    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.activeSessionId).toBe('1');
    expect(snapshot.logs).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/background/__tests__/state-manager.test.ts`
Expected: FAIL with "Cannot find module '../state-manager'"

**Step 3: Write minimal implementation**

```typescript
// src/background/state-manager.ts

import type { Session, APIStatus } from '../types';

export interface ActionLog {
  timestamp: number;
  action: string;
  data: Record<string, unknown>;
}

export interface DebugSnapshot {
  sessions: Session[];
  activeSessionId: string | null;
  apiStatuses: Record<string, APIStatus>;
  logs: ActionLog[];
  exportedAt: number;
}

export class StateManager {
  private sessions: Session[] = [];
  private activeSessionId: string | null = null;
  private apiStatuses: Map<string, APIStatus> = new Map();
  private logs: ActionLog[] = [];

  setSessions(sessions: Session[]): void {
    this.sessions = sessions;
    this.logAction('SESSIONS_UPDATED', { count: sessions.length });
  }

  getSessions(): Session[] {
    return this.sessions;
  }

  setActiveSession(sessionId: string | null): void {
    this.activeSessionId = sessionId;
    this.logAction('ACTIVE_SESSION_CHANGED', { sessionId });
  }

  getActiveSession(): string | null {
    return this.activeSessionId;
  }

  setAPIStatus(provider: string, status: Partial<APIStatus>): void {
    const current = this.apiStatuses.get(provider) || {
      provider: provider as 'minimax' | 'glm',
      connected: false,
      latency: null,
      error: null,
    };
    this.apiStatuses.set(provider, { ...current, ...status });
  }

  getAPIStatus(provider: string): APIStatus | undefined {
    return this.apiStatuses.get(provider);
  }

  logAction(action: string, data: Record<string, unknown>): void {
    this.logs.push({
      timestamp: Date.now(),
      action,
      data,
    });

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  getLogs(): ActionLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportSnapshot(): DebugSnapshot {
    return {
      sessions: this.sessions,
      activeSessionId: this.activeSessionId,
      apiStatuses: Object.fromEntries(this.apiStatuses),
      logs: this.logs,
      exportedAt: Date.now(),
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/background/__tests__/state-manager.test.ts`
Expected: PASS

**Step 5: Create background service worker**

```typescript
// src/background/background.ts

import { StateManager } from './state-manager';

const state = new StateManager();

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle messages from side panel and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATE': {
      sendResponse({
        sessions: state.getSessions(),
        activeSessionId: state.getActiveSession(),
      });
      break;
    }
    case 'SET_SESSIONS': {
      state.setSessions(message.sessions);
      sendResponse({ success: true });
      break;
    }
    case 'SET_ACTIVE_SESSION': {
      state.setActiveSession(message.sessionId);
      sendResponse({ success: true });
      break;
    }
    case 'LOG_ACTION': {
      state.logAction(message.action, message.data);
      sendResponse({ success: true });
      break;
    }
    case 'GET_LOGS': {
      sendResponse({ logs: state.getLogs() });
      break;
    }
    case 'EXPORT_SNAPSHOT': {
      sendResponse({ snapshot: state.exportSnapshot() });
      break;
    }
    case 'CHECK_API': {
      // Will be implemented in Task 9
      sendResponse({ success: false, error: 'Not implemented' });
      break;
    }
  }
  return true;
});

console.log('[Happy Debug] Background service worker started');
```

**Step 6: Commit**

```bash
git add src/background/
git commit -m "feat: add background service worker with state management"
```

---

## Task 8: Create Side Panel - Base Structure

**Files:**
- Create: `src/sidepanel/sidepanel.html`
- Create: `src/sidepanel/sidepanel.css`
- Create: `src/sidepanel/sidepanel.ts`

**Step 1: Create HTML structure**

```html
<!-- src/sidepanel/sidepanel.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Happy Debug Console</title>
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>Happy Debug Console</h1>
      <span class="version">v1.0</span>
    </header>

    <!-- Section: Environment -->
    <section class="panel" id="panel-environment">
      <h2 class="panel-title" data-toggle="environment">
        <span class="toggle-icon">▼</span>
        Environment
      </h2>
      <div class="panel-content" id="content-environment">
        <div class="api-status">
          <div class="status-item">
            <span class="label">MiniMax API:</span>
            <span class="status" id="status-minimax">Unknown</span>
            <button class="btn-small" id="btn-check-minimax">Check</button>
          </div>
          <div class="status-item">
            <span class="label">GLM API:</span>
            <span class="status" id="status-glm">Unknown</span>
            <button class="btn-small" id="btn-check-glm">Check</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Section: Session / Terminal -->
    <section class="panel" id="panel-session">
      <h2 class="panel-title" data-toggle="session">
        <span class="toggle-icon">▼</span>
        Session / Terminal
      </h2>
      <div class="panel-content" id="content-session">
        <button class="btn-primary" id="btn-scan-sessions">Scan Sessions</button>
        <div class="session-list" id="session-list">
          <p class="placeholder">No sessions scanned yet</p>
        </div>
        <div class="active-session">
          <span class="label">Active:</span>
          <span id="active-session-id">None</span>
        </div>
      </div>
    </section>

    <!-- Section: Input Simulation -->
    <section class="panel" id="panel-input">
      <h2 class="panel-title" data-toggle="input">
        <span class="toggle-icon">▼</span>
        Input Simulation
      </h2>
      <div class="panel-content" id="content-input">
        <textarea id="input-text" placeholder="Enter test input..."></textarea>
        <div class="button-group">
          <button class="btn-primary" id="btn-preview-input">Preview</button>
          <button class="btn-secondary" id="btn-clear-input">Clear</button>
        </div>
      </div>
    </section>

    <!-- Section: API / AI Judge -->
    <section class="panel" id="panel-ai">
      <h2 class="panel-title" data-toggle="ai">
        <span class="toggle-icon">▼</span>
        API / AI Judge
      </h2>
      <div class="panel-content" id="content-ai">
        <div class="form-group">
          <label>Lines to analyze:</label>
          <input type="number" id="analyze-lines" value="10" min="1" max="100">
        </div>
        <button class="btn-primary" id="btn-analyze">Analyze Session</button>
        <div class="ai-result" id="ai-result">
          <p class="placeholder">No analysis yet</p>
        </div>
      </div>
    </section>

    <!-- Section: Action Simulation -->
    <section class="panel" id="panel-action">
      <h2 class="panel-title" data-toggle="action">
        <span class="toggle-icon">▼</span>
        Action Simulation
      </h2>
      <div class="panel-content" id="content-action">
        <div class="action-preview" id="action-preview">
          <p class="placeholder">No action to preview</p>
        </div>
        <div class="button-group">
          <button class="btn-warning" id="btn-execute" disabled>Execute</button>
          <button class="btn-secondary" id="btn-cancel-action" disabled>Cancel</button>
        </div>
      </div>
    </section>

    <!-- Section: Logs & Inspector -->
    <section class="panel" id="panel-logs">
      <h2 class="panel-title" data-toggle="logs">
        <span class="toggle-icon">▼</span>
        Logs & Inspector
      </h2>
      <div class="panel-content" id="content-logs">
        <div class="log-viewer" id="log-viewer">
          <p class="placeholder">No logs yet</p>
        </div>
        <div class="button-group">
          <button class="btn-secondary" id="btn-export-logs">Export Snapshot</button>
          <button class="btn-secondary" id="btn-clear-logs">Clear Logs</button>
        </div>
      </div>
    </section>
  </div>

  <script type="module" src="sidepanel.js"></script>
</body>
</html>
```

**Step 2: Create CSS styles**

```css
/* src/sidepanel/sidepanel.css */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  background: #1e1e1e;
  color: #e0e0e0;
  line-height: 1.4;
}

.container {
  padding: 12px;
  max-width: 400px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #333;
  margin-bottom: 12px;
}

.header h1 {
  font-size: 16px;
  font-weight: 600;
}

.version {
  font-size: 11px;
  color: #888;
}

/* Panel styles */
.panel {
  background: #252526;
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
}

.panel-title {
  font-size: 13px;
  font-weight: 500;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2d2d2d;
  user-select: none;
}

.panel-title:hover {
  background: #333;
}

.toggle-icon {
  font-size: 10px;
  transition: transform 0.2s;
}

.panel.collapsed .toggle-icon {
  transform: rotate(-90deg);
}

.panel.collapsed .panel-content {
  display: none;
}

.panel-content {
  padding: 12px;
}

/* Status styles */
.api-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-item .label {
  flex: 0 0 80px;
  color: #888;
}

.status-item .status {
  flex: 1;
  font-family: monospace;
}

.status.connected {
  color: #4caf50;
}

.status.error {
  color: #f44336;
}

.status.checking {
  color: #ff9800;
}

/* Button styles */
button {
  font-family: inherit;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary {
  background: #0078d4;
  color: white;
}

.btn-primary:hover {
  background: #106ebe;
}

.btn-secondary {
  background: #3c3c3c;
  color: #e0e0e0;
}

.btn-secondary:hover {
  background: #4a4a4a;
}

.btn-warning {
  background: #f44336;
  color: white;
}

.btn-warning:hover {
  background: #d32f2f;
}

.btn-warning:disabled {
  background: #5a2d2d;
  cursor: not-allowed;
}

.btn-small {
  padding: 4px 8px;
  font-size: 11px;
  background: #3c3c3c;
  color: #e0e0e0;
}

.btn-small:hover {
  background: #4a4a4a;
}

.button-group {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* Session list */
.session-list {
  margin: 8px 0;
  max-height: 200px;
  overflow-y: auto;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 8px;
  background: #1e1e1e;
  border-radius: 4px;
  margin-bottom: 4px;
  cursor: pointer;
}

.session-item:hover {
  background: #2a2a2a;
}

.session-item.active {
  border-left: 3px solid #0078d4;
}

.session-item .session-id {
  font-family: monospace;
  font-size: 11px;
  color: #888;
  margin-right: 8px;
}

.session-item .session-title {
  flex: 1;
}

.session-item .session-visibility {
  font-size: 10px;
  color: #888;
}

.active-session {
  margin-top: 8px;
  padding: 8px;
  background: #1e1e1e;
  border-radius: 4px;
}

/* Input simulation */
textarea {
  width: 100%;
  height: 60px;
  padding: 8px;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 4px;
  color: #e0e0e0;
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
}

textarea:focus {
  outline: none;
  border-color: #0078d4;
}

/* Form inputs */
.form-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.form-group label {
  color: #888;
}

.form-group input[type="number"] {
  width: 60px;
  padding: 4px 8px;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 4px;
  color: #e0e0e0;
}

/* AI result */
.ai-result {
  margin-top: 8px;
  padding: 8px;
  background: #1e1e1e;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

.ai-result .result-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.ai-result .result-label {
  color: #888;
}

.ai-result .result-value {
  font-weight: 500;
}

/* Action preview */
.action-preview {
  padding: 8px;
  background: #1e1e1e;
  border-radius: 4px;
  border-left: 3px solid #ff9800;
}

/* Log viewer */
.log-viewer {
  height: 150px;
  overflow-y: auto;
  padding: 8px;
  background: #1e1e1e;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

.log-entry {
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
}

.log-entry .log-time {
  color: #888;
  margin-right: 8px;
}

.log-entry .log-action {
  color: #0078d4;
}

/* Placeholder */
.placeholder {
  color: #666;
  font-style: italic;
}
```

**Step 3: Create TypeScript entry point**

```typescript
// src/sidepanel/sidepanel.ts

import type { Session, AIJudgeOutput } from '../types';

class DebugConsole {
  private activeSessionId: string | null = null;
  private sessions: Session[] = [];

  constructor() {
    this.initializeEventListeners();
    this.initializePanelToggles();
  }

  private initializePanelToggles(): void {
    document.querySelectorAll('.panel-title').forEach((title) => {
      title.addEventListener('click', () => {
        const panel = title.closest('.panel');
        panel?.classList.toggle('collapsed');
      });
    });
  }

  private initializeEventListeners(): void {
    // Environment section
    document.getElementById('btn-check-minimax')?.addEventListener('click', () => this.checkAPI('minimax'));
    document.getElementById('btn-check-glm')?.addEventListener('click', () => this.checkAPI('glm'));

    // Session section
    document.getElementById('btn-scan-sessions')?.addEventListener('click', () => this.scanSessions());

    // Input section
    document.getElementById('btn-preview-input')?.addEventListener('click', () => this.previewInput());
    document.getElementById('btn-clear-input')?.addEventListener('click', () => this.clearInput());

    // AI section
    document.getElementById('btn-analyze')?.addEventListener('click', () => this.analyzeSession());

    // Action section
    document.getElementById('btn-execute')?.addEventListener('click', () => this.executeAction());
    document.getElementById('btn-cancel-action')?.addEventListener('click', () => this.cancelAction());

    // Logs section
    document.getElementById('btn-export-logs')?.addEventListener('click', () => this.exportSnapshot());
    document.getElementById('btn-clear-logs')?.addEventListener('click', () => this.clearLogs());
  }

  private async sendToContent<T>(message: Record<string, unknown>): Promise<T> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('No active tab');
    return chrome.tabs.sendMessage(tab.id, message);
  }

  private async sendToBackground<T>(message: Record<string, unknown>): Promise<T> {
    return chrome.runtime.sendMessage(message);
  }

  private log(action: string, data: Record<string, unknown> = {}): void {
    this.sendToBackground({ type: 'LOG_ACTION', action, data });
    this.appendLogEntry(action, data);
  }

  private appendLogEntry(action: string, data: Record<string, unknown>): void {
    const viewer = document.getElementById('log-viewer');
    if (!viewer) return;

    // Remove placeholder if present
    const placeholder = viewer.querySelector('.placeholder');
    placeholder?.remove();

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-action">${action}</span>
      ${Object.keys(data).length > 0 ? `<div>${JSON.stringify(data)}</div>` : ''}
    `;
    viewer.appendChild(entry);
    viewer.scrollTop = viewer.scrollHeight;
  }

  private async checkAPI(provider: 'minimax' | 'glm'): Promise<void> {
    const statusEl = document.getElementById(`status-${provider}`);
    if (!statusEl) return;

    statusEl.textContent = 'Checking...';
    statusEl.className = 'status checking';

    this.log('CHECK_API', { provider });

    // TODO: Implement actual API check in Task 9
    setTimeout(() => {
      statusEl.textContent = 'Not configured';
      statusEl.className = 'status error';
    }, 1000);
  }

  private async scanSessions(): Promise<void> {
    this.log('SCAN_SESSIONS_START');

    try {
      const result = await this.sendToContent<{ sessions: Session[] }>({ type: 'SCAN_SESSIONS' });
      this.sessions = result.sessions;
      this.renderSessionList();
      this.log('SCAN_SESSIONS_COMPLETE', { count: this.sessions.length });
    } catch (error) {
      this.log('SCAN_SESSIONS_ERROR', { error: String(error) });
    }
  }

  private renderSessionList(): void {
    const list = document.getElementById('session-list');
    if (!list) return;

    if (this.sessions.length === 0) {
      list.innerHTML = '<p class="placeholder">No sessions found</p>';
      return;
    }

    list.innerHTML = this.sessions.map((session) => `
      <div class="session-item ${session.sessionId === this.activeSessionId ? 'active' : ''}"
           data-session-id="${session.sessionId}">
        <span class="session-id">#${session.sessionId}</span>
        <span class="session-title">${session.title}</span>
        <span class="session-visibility">${session.visible ? 'visible' : 'hidden'}</span>
      </div>
    `).join('');

    // Add click listeners
    list.querySelectorAll('.session-item').forEach((item) => {
      item.addEventListener('click', () => {
        const sessionId = (item as HTMLElement).dataset.sessionId;
        if (sessionId) this.switchSession(sessionId);
      });
    });
  }

  private async switchSession(sessionId: string): Promise<void> {
    // Unhighlight previous
    if (this.activeSessionId) {
      await this.sendToContent({ type: 'HIGHLIGHT_SESSION', sessionId: this.activeSessionId, highlight: false });
    }

    this.activeSessionId = sessionId;

    // Highlight new
    await this.sendToContent({ type: 'HIGHLIGHT_SESSION', sessionId, highlight: true });

    // Update UI
    this.renderSessionList();
    const activeEl = document.getElementById('active-session-id');
    if (activeEl) activeEl.textContent = sessionId;

    this.log('SWITCH_SESSION', { sessionId });
  }

  private async previewInput(): Promise<void> {
    if (!this.activeSessionId) {
      this.log('PREVIEW_INPUT_ERROR', { error: 'No active session' });
      return;
    }

    const textarea = document.getElementById('input-text') as HTMLTextAreaElement;
    const text = textarea?.value || '';

    this.log('PREVIEW_INPUT', { sessionId: this.activeSessionId, text });

    await this.sendToContent({
      type: 'PREVIEW_INPUT',
      sessionId: this.activeSessionId,
      text,
    });
  }

  private async clearInput(): Promise<void> {
    if (!this.activeSessionId) return;

    this.log('CLEAR_INPUT', { sessionId: this.activeSessionId });

    await this.sendToContent({
      type: 'CLEAR_PREVIEW',
      sessionId: this.activeSessionId,
    });

    const textarea = document.getElementById('input-text') as HTMLTextAreaElement;
    if (textarea) textarea.value = '';
  }

  private async analyzeSession(): Promise<void> {
    if (!this.activeSessionId) {
      this.log('ANALYZE_ERROR', { error: 'No active session' });
      return;
    }

    const linesInput = document.getElementById('analyze-lines') as HTMLInputElement;
    const lines = parseInt(linesInput?.value || '10', 10);

    this.log('ANALYZE_START', { sessionId: this.activeSessionId, lines });

    const resultEl = document.getElementById('ai-result');
    if (resultEl) {
      resultEl.innerHTML = '<p class="placeholder">Analyzing...</p>';
    }

    try {
      // Get session output
      const outputResult = await this.sendToContent<{ output: string[] }>({
        type: 'GET_SESSION_OUTPUT',
        sessionId: this.activeSessionId,
        lines,
      });

      // TODO: Send to AI Judge in Task 9
      // For now, show mock result
      this.renderAIResult({
        role: 'Other',
        state: 'RUNNING',
        confidence: 0.0,
      });

      this.log('ANALYZE_COMPLETE', { output: outputResult.output });
    } catch (error) {
      this.log('ANALYZE_ERROR', { error: String(error) });
      if (resultEl) {
        resultEl.innerHTML = `<p class="placeholder" style="color: #f44336;">Error: ${error}</p>`;
      }
    }
  }

  private renderAIResult(result: AIJudgeOutput): void {
    const el = document.getElementById('ai-result');
    if (!el) return;

    el.innerHTML = `
      <div class="result-row">
        <span class="result-label">Role:</span>
        <span class="result-value">${result.role}</span>
      </div>
      <div class="result-row">
        <span class="result-label">State:</span>
        <span class="result-value">${result.state}</span>
      </div>
      <div class="result-row">
        <span class="result-label">Confidence:</span>
        <span class="result-value">${(result.confidence * 100).toFixed(1)}%</span>
      </div>
    `;

    // Update action preview based on result
    this.updateActionPreview(result);
  }

  private updateActionPreview(result: AIJudgeOutput): void {
    const previewEl = document.getElementById('action-preview');
    const executeBtn = document.getElementById('btn-execute') as HTMLButtonElement;
    const cancelBtn = document.getElementById('btn-cancel-action') as HTMLButtonElement;

    if (!previewEl || !executeBtn || !cancelBtn) return;

    if (result.state === 'WAITING_INPUT' && result.confidence > 0.7) {
      previewEl.innerHTML = `
        <div><strong>Suggested Action:</strong></div>
        <div>Send input to ${result.role} session</div>
        <div style="color: #888; font-size: 10px;">Confidence: ${(result.confidence * 100).toFixed(1)}%</div>
      `;
      executeBtn.disabled = false;
      cancelBtn.disabled = false;
    } else {
      previewEl.innerHTML = '<p class="placeholder">No action suggested (confidence too low or not waiting)</p>';
      executeBtn.disabled = true;
      cancelBtn.disabled = true;
    }
  }

  private executeAction(): void {
    // TODO: Implement with confirmation dialog
    this.log('EXECUTE_ACTION_BLOCKED', { reason: 'Not implemented - requires confirmation' });
    alert('Action execution requires confirmation. This feature is not yet implemented.');
  }

  private cancelAction(): void {
    const previewEl = document.getElementById('action-preview');
    const executeBtn = document.getElementById('btn-execute') as HTMLButtonElement;
    const cancelBtn = document.getElementById('btn-cancel-action') as HTMLButtonElement;

    if (previewEl) {
      previewEl.innerHTML = '<p class="placeholder">Action cancelled</p>';
    }
    if (executeBtn) executeBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    this.log('ACTION_CANCELLED');
  }

  private async exportSnapshot(): Promise<void> {
    this.log('EXPORT_SNAPSHOT_START');

    const result = await this.sendToBackground<{ snapshot: unknown }>({ type: 'EXPORT_SNAPSHOT' });

    const blob = new Blob([JSON.stringify(result.snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `happy-debug-snapshot-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    this.log('EXPORT_SNAPSHOT_COMPLETE');
  }

  private async clearLogs(): Promise<void> {
    const viewer = document.getElementById('log-viewer');
    if (viewer) {
      viewer.innerHTML = '<p class="placeholder">Logs cleared</p>';
    }
    this.log('LOGS_CLEARED');
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new DebugConsole();
});
```

**Step 4: Commit**

```bash
git add src/sidepanel/
git commit -m "feat: add side panel UI structure"
```

---

## Task 9: Create API Integration Module

**Files:**
- Create: `src/services/api-client.ts`
- Create: `src/services/ai-judge.ts`
- Modify: `src/background/background.ts`
- Test: `src/services/__tests__/ai-judge.test.ts`

**Step 1: Write the failing test**

```typescript
// src/services/__tests__/ai-judge.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIJudge } from '../ai-judge';

describe('AIJudge', () => {
  let judge: AIJudge;

  beforeEach(() => {
    judge = new AIJudge();
  });

  it('should format input for API call', () => {
    const recentText = ['$ npm install', 'Installing...', 'Done'];
    const signals = { hasPrompt: true };

    const formatted = judge.formatInput(recentText, signals);

    expect(formatted.recent_text).toEqual(recentText);
    expect(formatted.signals).toEqual(signals);
  });

  it('should parse valid API response', () => {
    const response = {
      role: 'Executor',
      state: 'WAITING_INPUT',
      confidence: 0.85,
    };

    const parsed = judge.parseResponse(response);

    expect(parsed.role).toBe('Executor');
    expect(parsed.state).toBe('WAITING_INPUT');
    expect(parsed.confidence).toBe(0.85);
  });

  it('should handle invalid response with defaults', () => {
    const response = { invalid: 'data' };

    const parsed = judge.parseResponse(response);

    expect(parsed.role).toBe('Other');
    expect(parsed.state).toBe('RUNNING');
    expect(parsed.confidence).toBe(0);
  });

  it('should detect dangerous commands', () => {
    const dangerousCommands = [
      'rm -rf /',
      'sudo rm -rf *',
      'format c:',
      ':(){:|:&};:',
    ];

    dangerousCommands.forEach((cmd) => {
      expect(judge.isDangerousCommand(cmd)).toBe(true);
    });
  });

  it('should allow safe commands', () => {
    const safeCommands = [
      'ls -la',
      'npm install',
      'git status',
      'echo hello',
    ];

    safeCommands.forEach((cmd) => {
      expect(judge.isDangerousCommand(cmd)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/__tests__/ai-judge.test.ts`
Expected: FAIL with "Cannot find module '../ai-judge'"

**Step 3: Create API client**

```typescript
// src/services/api-client.ts

export interface APIConfig {
  provider: 'minimax' | 'glm';
  apiKey: string;
  baseUrl: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

export class APIClient {
  private config: APIConfig;

  constructor(config: APIConfig) {
    this.config = config;
  }

  async checkConnection(): Promise<APIResponse<{ connected: boolean }>> {
    const start = Date.now();

    try {
      // Minimal request to check connectivity
      const response = await fetch(this.config.baseUrl, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      const latency = Date.now() - start;

      return {
        success: response.ok,
        data: { connected: response.ok },
        latency,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  async post<T>(endpoint: string, body: unknown): Promise<APIResponse<T>> {
    const start = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const latency = Date.now() - start;

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          latency,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }
}
```

**Step 4: Create AI Judge**

```typescript
// src/services/ai-judge.ts

import type { AIJudgeInput, AIJudgeOutput, SessionRole, SessionState } from '../types';
import { APIClient } from './api-client';

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/i,
  /rm\s+-rf\s+\*/i,
  /rm\s+-r\s+[\/~]/i,
  /mkfs\./i,
  /dd\s+if=.*of=\/dev/i,
  /format\s+[a-z]:/i,
  />\s*\/dev\/sd[a-z]/i,
  /:\(\)\s*\{\s*:\|\:&\s*\}\s*;:/,  // Fork bomb
  /chmod\s+-R\s+777\s+\//,
  /wget.*\|\s*bash/i,
  /curl.*\|\s*bash/i,
];

export class AIJudge {
  private client: APIClient | null = null;

  setClient(client: APIClient): void {
    this.client = client;
  }

  formatInput(recentText: string[], signals: Record<string, unknown>): AIJudgeInput {
    return {
      recent_text: recentText,
      signals,
    };
  }

  parseResponse(response: unknown): AIJudgeOutput {
    const defaultOutput: AIJudgeOutput = {
      role: 'Other',
      state: 'RUNNING',
      confidence: 0,
    };

    if (typeof response !== 'object' || response === null) {
      return defaultOutput;
    }

    const obj = response as Record<string, unknown>;

    const validRoles: SessionRole[] = ['Advisor', 'Executor', 'Other'];
    const validStates: SessionState[] = ['RUNNING', 'WAITING_INPUT', 'ERROR'];

    return {
      role: validRoles.includes(obj.role as SessionRole) ? (obj.role as SessionRole) : 'Other',
      state: validStates.includes(obj.state as SessionState) ? (obj.state as SessionState) : 'RUNNING',
      confidence: typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0,
    };
  }

  isDangerousCommand(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
  }

  async analyze(input: AIJudgeInput): Promise<AIJudgeOutput> {
    if (!this.client) {
      console.warn('[AIJudge] No API client configured, using rule-based analysis');
      return this.ruleBasedAnalysis(input);
    }

    try {
      const response = await this.client.post<AIJudgeOutput>('/analyze', input);

      if (response.success && response.data) {
        return this.parseResponse(response.data);
      }

      console.warn('[AIJudge] API call failed, falling back to rule-based:', response.error);
      return this.ruleBasedAnalysis(input);
    } catch (error) {
      console.error('[AIJudge] Error:', error);
      return this.ruleBasedAnalysis(input);
    }
  }

  private ruleBasedAnalysis(input: AIJudgeInput): AIJudgeOutput {
    const lastLine = input.recent_text[input.recent_text.length - 1] || '';

    // Check for prompt patterns
    const promptPatterns = [
      /\$\s*$/,
      />\s*$/,
      /:\s*$/,
      /\?\s*$/,
      /input/i,
      /enter/i,
      /password/i,
      /y\/n/i,
    ];

    const isWaiting = promptPatterns.some((p) => p.test(lastLine));

    // Detect role from context
    let role: SessionRole = 'Other';
    const advisorPatterns = [/claude/i, /gpt/i, /ai/i, /assistant/i];
    const executorPatterns = [/\$/, /bash/, /shell/, /terminal/i, /cmd/i];

    const allText = input.recent_text.join(' ');
    if (advisorPatterns.some((p) => p.test(allText))) {
      role = 'Advisor';
    } else if (executorPatterns.some((p) => p.test(allText))) {
      role = 'Executor';
    }

    return {
      role,
      state: isWaiting ? 'WAITING_INPUT' : 'RUNNING',
      confidence: 0.6, // Rule-based has lower confidence
    };
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/__tests__/ai-judge.test.ts`
Expected: PASS

**Step 6: Update background script to use AI Judge**

```typescript
// src/background/background.ts (updated)

import { StateManager } from './state-manager';
import { AIJudge } from '../services/ai-judge';
import { APIClient } from '../services/api-client';

const state = new StateManager();
const aiJudge = new AIJudge();

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle messages from side panel and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sendResponse);
  return true; // Keep channel open for async
});

async function handleMessage(
  message: Record<string, unknown>,
  sendResponse: (response: unknown) => void
): Promise<void> {
  switch (message.type) {
    case 'GET_STATE': {
      sendResponse({
        sessions: state.getSessions(),
        activeSessionId: state.getActiveSession(),
      });
      break;
    }
    case 'SET_SESSIONS': {
      state.setSessions(message.sessions as []);
      sendResponse({ success: true });
      break;
    }
    case 'SET_ACTIVE_SESSION': {
      state.setActiveSession(message.sessionId as string);
      sendResponse({ success: true });
      break;
    }
    case 'LOG_ACTION': {
      state.logAction(message.action as string, message.data as Record<string, unknown>);
      sendResponse({ success: true });
      break;
    }
    case 'GET_LOGS': {
      sendResponse({ logs: state.getLogs() });
      break;
    }
    case 'EXPORT_SNAPSHOT': {
      sendResponse({ snapshot: state.exportSnapshot() });
      break;
    }
    case 'CHECK_API': {
      const provider = message.provider as string;
      const apiKey = await getAPIKey(provider);

      if (!apiKey) {
        sendResponse({ success: false, error: 'API key not configured' });
        state.setAPIStatus(provider, { connected: false, error: 'Not configured' });
        break;
      }

      const client = new APIClient({
        provider: provider as 'minimax' | 'glm',
        apiKey,
        baseUrl: getBaseUrl(provider),
      });

      const result = await client.checkConnection();
      state.setAPIStatus(provider, {
        connected: result.success,
        latency: result.latency || null,
        error: result.error || null,
      });

      sendResponse(result);
      break;
    }
    case 'ANALYZE_SESSION': {
      const input = message.input as { recent_text: string[]; signals: Record<string, unknown> };
      const result = await aiJudge.analyze(aiJudge.formatInput(input.recent_text, input.signals));
      sendResponse({ success: true, result });
      break;
    }
    case 'CHECK_DANGEROUS': {
      const command = message.command as string;
      sendResponse({ isDangerous: aiJudge.isDangerousCommand(command) });
      break;
    }
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
}

async function getAPIKey(provider: string): Promise<string | null> {
  const result = await chrome.storage.local.get([`${provider}_api_key`]);
  return result[`${provider}_api_key`] || null;
}

function getBaseUrl(provider: string): string {
  switch (provider) {
    case 'minimax':
      return 'https://api.minimax.chat/v1';
    case 'glm':
      return 'https://open.bigmodel.cn/api/paas/v4';
    default:
      return '';
  }
}

console.log('[Happy Debug] Background service worker started');
```

**Step 7: Commit**

```bash
git add src/services/ src/background/
git commit -m "feat: add API client and AI Judge service"
```

---

## Task 10: Create Popup for Quick Access

**Files:**
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.css`
- Create: `src/popup/popup.ts`

**Step 1: Create popup HTML**

```html
<!-- src/popup/popup.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Happy Debug</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <h1>Happy Debug Console</h1>
    <p class="description">Multi-terminal debug tool</p>
    <button class="btn-primary" id="btn-open-panel">Open Debug Panel</button>
    <div class="quick-status">
      <div class="status-item">
        <span class="label">Sessions:</span>
        <span id="session-count">-</span>
      </div>
      <div class="status-item">
        <span class="label">Active:</span>
        <span id="active-session">None</span>
      </div>
    </div>
  </div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

**Step 2: Create popup CSS**

```css
/* src/popup/popup.css */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  background: #1e1e1e;
  color: #e0e0e0;
  width: 280px;
  padding: 16px;
}

h1 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.description {
  color: #888;
  margin-bottom: 16px;
}

.btn-primary {
  width: 100%;
  padding: 10px;
  background: #0078d4;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 16px;
}

.btn-primary:hover {
  background: #106ebe;
}

.quick-status {
  background: #252526;
  border-radius: 4px;
  padding: 12px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.status-item:last-child {
  margin-bottom: 0;
}

.label {
  color: #888;
}
```

**Step 3: Create popup TypeScript**

```typescript
// src/popup/popup.ts

async function init(): Promise<void> {
  // Load current state
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

  const sessionCountEl = document.getElementById('session-count');
  const activeSessionEl = document.getElementById('active-session');

  if (sessionCountEl) {
    sessionCountEl.textContent = state.sessions?.length?.toString() || '0';
  }

  if (activeSessionEl) {
    activeSessionEl.textContent = state.activeSessionId || 'None';
  }

  // Open panel button
  document.getElementById('btn-open-panel')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
```

**Step 4: Commit**

```bash
git add src/popup/
git commit -m "feat: add popup for quick access"
```

---

## Task 11: Update Build Configuration

**Files:**
- Modify: `vite.config.ts`
- Create: `scripts/copy-manifest.ts`

**Step 1: Update Vite config for proper Chrome extension build**

```typescript
// vite.config.ts (updated)

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name + '.js';
        },
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return '[name].[ext]';
          }
          return 'assets/[name].[ext]';
        },
      },
    },
  },
  plugins: [
    {
      name: 'copy-extension-files',
      closeBundle() {
        // Copy manifest
        copyFileSync('src/manifest.json', 'dist/manifest.json');

        // Copy icons
        mkdirSync('dist/icons', { recursive: true });
        ['icon16.png', 'icon48.png', 'icon128.png'].forEach((icon) => {
          try {
            copyFileSync(`public/icons/${icon}`, `dist/icons/${icon}`);
          } catch {
            console.warn(`Icon ${icon} not found, skipping`);
          }
        });
      },
    },
  ],
});
```

**Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "chore: update build config for Chrome extension"
```

---

## Task 12: Run Tests and Build

**Files:**
- None (verification task)

**Step 1: Install dependencies**

Run: `npm install`
Expected: Dependencies installed successfully

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Build extension**

Run: `npm run build`
Expected: Build completes, dist/ folder created with all extension files

**Step 4: Verify build output**

Run: `ls -la dist/`
Expected: manifest.json, popup.html, sidepanel.html, background.js, content.js, CSS files, icons/

**Step 5: Commit any test fixes**

```bash
git add -A
git commit -m "test: verify all tests pass and build succeeds"
```

---

## Task 13: Manual Testing in Chrome

**Files:**
- None (manual testing task)

**Step 1: Load extension in Chrome**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

**Step 2: Test popup**

1. Click extension icon
2. Verify popup shows
3. Click "Open Debug Panel"
4. Verify side panel opens

**Step 3: Test session scanning**

1. Navigate to a page with `data-session-id` elements (or create test HTML)
2. Click "Scan Sessions"
3. Verify sessions appear in list

**Step 4: Test input preview**

1. Select a session
2. Enter text in input field
3. Click "Preview"
4. Verify text appears in target input (highlighted)
5. Click "Clear"
6. Verify input cleared

**Step 5: Test log export**

1. Perform several actions
2. Click "Export Snapshot"
3. Verify JSON file downloads
4. Verify JSON contains sessions, logs, timestamps

**Step 6: Document any issues**

Create issues or fix bugs found during testing.

---

## Task 14: Add Documentation

**Files:**
- Create: `README.md`

**Step 1: Create README**

```markdown
# Happy Debug Console

Chrome Extension v1.0 for debugging multi-terminal Happy environments.

## Features

- **Session Scanning**: Detect and list all terminal sessions on page
- **Input Preview**: Test input injection without execution
- **AI Analysis**: Analyze session state with AI-powered judgment
- **Action Preview**: Preview suggested actions before execution
- **Debug Logging**: Full action logging with export capability

## Installation

1. Clone repository
2. Run `npm install`
3. Run `npm run build`
4. Load `dist/` folder in Chrome as unpacked extension

## Development

```bash
npm run dev    # Watch mode
npm test       # Run tests
npm run build  # Production build
```

## Usage

1. Click extension icon to open popup
2. Click "Open Debug Panel" for full console
3. Use "Scan Sessions" to detect terminals
4. Select a session to interact with
5. Use input preview and AI analysis features

## Safety

- All actions require preview before execution
- Dangerous commands are detected and blocked
- No automatic execution without confirmation
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add project README"
```

---

## Summary

This plan implements the Happy Plugin v1.0 Debug Console with:

1. **Project Setup** (Tasks 1-2): TypeScript, Vite, Chrome Extension Manifest V3
2. **Type Definitions** (Task 3): Session, AI Judge, Message types
3. **Content Scripts** (Tasks 4-6): Session scanner, input injector, output listener
4. **Background Worker** (Task 7): State management, message handling
5. **UI** (Tasks 8, 10): Side panel debug console, popup quick access
6. **API Integration** (Task 9): API client, AI Judge service
7. **Build & Test** (Tasks 11-13): Build configuration, testing, verification
8. **Documentation** (Task 14): README

Total: **14 tasks** following TDD with frequent commits.

---

Plan complete and saved to `docs/plans/2026-02-04-debug-console-v1.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
