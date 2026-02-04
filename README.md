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
