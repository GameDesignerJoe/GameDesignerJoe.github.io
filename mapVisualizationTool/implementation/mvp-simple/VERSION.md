# Version Compatibility Document

This document outlines the current versions of dependencies used in the Map Visualization Tool project and provides guidance for future maintenance and upgrades.

## Current Versions

| Package | Version | Notes |
|---------|---------|-------|
| React | 19.0.0 | Core UI library |
| React DOM | 19.0.0 | DOM rendering for React |
| TypeScript | 5.8.2 | Type checking and compilation |
| Vite | 6.2.0 | Build tool and development server |
| @vitejs/plugin-react | 4.3.4 | React plugin for Vite |
| Tailwind CSS | 3.4.1 | Utility-first CSS framework |
| PostCSS | 8.5.3 | CSS transformation tool |
| Autoprefixer | 10.4.20 | PostCSS plugin for vendor prefixes |

## Module Format

This project uses **CommonJS** format for configuration files:
- vite.config.js
- postcss.config.js
- tailwind.config.js

## Compatible Version Ranges

### React & React DOM
- Compatible with Vite 6.x: React 18.x - 19.x
- TypeScript compatibility: React 18.x - 19.x work with TypeScript 5.x

### TypeScript
- Compatible with Vite 6.x: TypeScript 5.x
- React compatibility: TypeScript 5.x works with React 18.x - 19.x

### Vite
- Node.js requirement: 18.x or newer
- Compatible React versions: 18.x - 19.x
- Compatible TypeScript versions: 5.x

## Upgrade Paths

When upgrading dependencies, follow these guidelines:

### Minor Version Upgrades
- Can generally be done independently for each package
- Test thoroughly after each upgrade

### Major Version Upgrades
- React & React DOM should be upgraded together
- When upgrading Vite to a new major version:
  1. Check compatibility with React and TypeScript versions
  2. Review changes to configuration options
  3. Update plugins as needed

## Troubleshooting Common Issues

### Module Format Conflicts
- Ensure all configuration files use the same module format (CommonJS)
- Check for "type": "module" in package.json if using ES modules

### TypeScript Configuration
- tsconfig.json should use "moduleResolution": "bundler" for Vite
- tsconfig.node.json should use "moduleResolution": "node" for Node.js files

### Path Resolution
- Use relative paths in HTML files for direct browser loading
- Use absolute paths (starting with /) for Vite development server

## Verification Process

After any dependency upgrade, verify:
1. Development server starts without errors
2. Application loads correctly in the browser
3. All features function as expected
4. Build process completes successfully
