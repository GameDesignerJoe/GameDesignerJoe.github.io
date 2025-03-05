# Fellowship Map Content Visualization Tool

A powerful tool for game designers to visualize content distribution across the Fellowship game map. This tool helps designers understand spatial relationships between different content types, evaluate player progression paths, and optimize content placement for engaging gameplay experiences.

## Project Overview

The Map Visualization Tool provides a three-panel interface:
1. **Input Panel**: Configure map parameters and content types
2. **Map Visualization Panel**: View the generated map with content distribution
3. **Analysis Panel**: Review metrics and insights about the content distribution

The tool uses a square grid system where each cell represents 1 meter in the game world. Content is distributed according to specified percentages, with visualization adapting to different zoom levels.

## Directory Structure

```
mapVisualizationTool/
├── assets/              # Shared assets like map backgrounds
├── implementation/      # Different implementation versions
│   ├── pre-mvp/         # Environment validation implementation
│   ├── vanilla/         # Simplified JavaScript implementation
│   ├── mvp/             # Full MVP implementation
│   └── mvp-simple/      # Simplified MVP implementation (current focus)
└── memory/              # Project documentation
    ├── design-document.md           # High-level design
    ├── technical-design-document.md # Technical specifications
    ├── implementation-plan.md       # Development roadmap
    ├── component-inventory.md       # UI component catalog
    └── ui-walkthrough.md            # User interface guide
```

## Implementation Variants

### pre-mvp
A validation project to test the development environment and technical foundation. Focuses on verifying React, TypeScript, Tailwind CSS, and Canvas API functionality.

### vanilla
A simplified implementation using vanilla JavaScript, HTML, and CSS without any build tools or frameworks. Used to validate core functionality without the complexity of a build system.

### mvp
The full MVP implementation with a structured component hierarchy and complete feature set as defined in the implementation plan.

### mvp-simple (Current Focus)
A simplified version of the MVP with core functionality intact but with a more streamlined implementation. This is the current focus of development.

## Current Status

The project is currently in the MVP phase of development. Key features implemented:

- ✅ Three-panel interface
- ✅ Map configuration (width, height, visual cell size)
- ✅ Content type management
- ✅ Square grid visualization (only on non-transparent portions of the map)
- ✅ Basic content distribution algorithm
- ✅ Analysis metrics
- ✅ PNG export

Upcoming features (in priority order):
1. **Adding additional content types** - Expanding beyond the current set of content types
2. Enhanced content distribution algorithms
3. Biome generation with adjacency rules
4. Interactive editing of the generated map
5. Additional export formats
6. Saving and loading map configurations

## Getting Started

### Prerequisites
- Node.js 18.x or newer
- npm or yarn

### Running the Current Implementation (mvp-simple)

1. Navigate to the mvp-simple directory:
   ```
   cd implementation/mvp-simple
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser to http://localhost:5173

### Static Demos

For quick previews without running the development server:
- `implementation/mvp-simple/static-demo.html` - A static HTML demo of the interface
- `implementation/mvp-simple/simple-viewer.html` - Documentation and overview

## Documentation

- [Design Document](memory/design-document.md): High-level overview of the tool's purpose, goals, and features
- [Technical Design Document](memory/technical-design-document.md): Detailed technical specifications and algorithms
- [Implementation Plan](memory/implementation-plan.md): Development roadmap with phases and milestones
- [Component Inventory](memory/component-inventory.md): Catalog of UI components with properties and interactions
- [UI Walkthrough](memory/ui-walkthrough.md): Guide to the user interface and interaction flows

## Technologies Used

- **React**: A JavaScript library for building user interfaces
- **TypeScript**: A typed superset of JavaScript
- **Vite**: A fast build tool and development server
- **Tailwind CSS**: A utility-first CSS framework
- **HTML5 Canvas API**: For drawing the grid and map visualization
