#!/usr/bin/env node

/**
 * Version Compatibility Checker
 * 
 * This script verifies that the installed dependencies are compatible with each other.
 * It checks:
 * 1. React and React DOM versions match
 * 2. TypeScript version is compatible with React
 * 3. Vite version is compatible with React and TypeScript
 * 4. Configuration files use consistent module formats
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Get the project root directory
const projectRoot = path.resolve(__dirname, '..');

// Read package.json
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log(`${colors.cyan}Checking dependency compatibility...${colors.reset}\n`);

// Extract dependency versions
const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

// Check if dependencies exist
const checkDependency = (name) => {
  if (!dependencies[name]) {
    console.log(`${colors.yellow}Warning: ${name} is not installed${colors.reset}`);
    return null;
  }
  
  // Remove version prefix (=, ^, ~)
  return dependencies[name].replace(/[=^~]/, '');
};

// Get versions
const reactVersion = checkDependency('react');
const reactDomVersion = checkDependency('react-dom');
const typescriptVersion = checkDependency('typescript');
const viteVersion = checkDependency('vite');
const tailwindVersion = checkDependency('tailwindcss');
const postcssVersion = checkDependency('postcss');

// Check React and React DOM versions match
if (reactVersion && reactDomVersion) {
  if (reactVersion === reactDomVersion) {
    console.log(`${colors.green}✓ React and React DOM versions match: ${reactVersion}${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ React (${reactVersion}) and React DOM (${reactDomVersion}) versions do not match${colors.reset}`);
  }
}

// Check TypeScript compatibility with React
if (reactVersion && typescriptVersion) {
  const reactMajor = parseInt(reactVersion.split('.')[0], 10);
  const tsMajor = parseInt(typescriptVersion.split('.')[0], 10);
  
  if (reactMajor >= 18 && tsMajor >= 5) {
    console.log(`${colors.green}✓ TypeScript ${typescriptVersion} is compatible with React ${reactVersion}${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ TypeScript ${typescriptVersion} may not be compatible with React ${reactVersion}${colors.reset}`);
    console.log(`  React 18+ works best with TypeScript 5+`);
  }
}

// Check Vite compatibility
if (viteVersion) {
  const viteMajor = parseInt(viteVersion.split('.')[0], 10);
  
  if (viteMajor === 6) {
    console.log(`${colors.green}✓ Vite ${viteVersion} is the latest major version${colors.reset}`);
  } else if (viteMajor < 6) {
    console.log(`${colors.yellow}⚠ Vite ${viteVersion} is not the latest major version (6.x)${colors.reset}`);
  }
  
  // Check Node.js version
  try {
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    
    if (viteMajor >= 6 && nodeMajor < 18) {
      console.log(`${colors.red}✗ Node.js ${nodeVersion} is not compatible with Vite 6+ (requires Node.js 18+)${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Node.js ${nodeVersion} is compatible with Vite ${viteVersion}${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠ Could not check Node.js version${colors.reset}`);
  }
}

// Check configuration files for consistent module format
console.log(`\n${colors.cyan}Checking configuration files...${colors.reset}`);

const checkConfigFile = (filePath, expectedFormat) => {
  try {
    const content = fs.readFileSync(path.join(projectRoot, filePath), 'utf8');
    
    const hasExportDefault = content.includes('export default');
    const hasModuleExports = content.includes('module.exports');
    
    const actualFormat = hasExportDefault ? 'ESM' : (hasModuleExports ? 'CommonJS' : 'Unknown');
    
    if (actualFormat === expectedFormat) {
      console.log(`${colors.green}✓ ${filePath} uses ${expectedFormat} format${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ ${filePath} uses ${actualFormat} format, expected ${expectedFormat}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠ Could not check ${filePath}: ${error.message}${colors.reset}`);
    return false;
  }
};

const configFiles = [
  { path: 'vite.config.js', format: 'CommonJS' },
  { path: 'postcss.config.js', format: 'CommonJS' },
  { path: 'tailwind.config.js', format: 'CommonJS' },
];

const allConfigsConsistent = configFiles.every(file => checkConfigFile(file.path, file.format));

if (allConfigsConsistent) {
  console.log(`\n${colors.green}✓ All configuration files use consistent module formats${colors.reset}`);
} else {
  console.log(`\n${colors.red}✗ Configuration files use inconsistent module formats${colors.reset}`);
  console.log(`  This project uses CommonJS format for configuration files`);
}

// Check package.json for "type": "module"
if (packageJson.type === 'module') {
  console.log(`\n${colors.yellow}⚠ package.json has "type": "module" but configuration files use CommonJS${colors.reset}`);
  console.log(`  Consider removing "type": "module" from package.json`);
}

console.log(`\n${colors.cyan}Compatibility check complete${colors.reset}`);
