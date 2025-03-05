# Map Visualization Tool

A powerful tool for creating and visualizing map content distributions using a grid system.

## Features

- **Three-Panel Interface**: Input Panel, Map Visualization Panel, and Analysis Panel
- **Map Configuration**: Set width, height, and cell size for the map
- **Content Type Management**: Create, edit, and remove content types with custom colors and distribution percentages
- **Grid Visualization**: View the generated map with a grid
- **Content Distribution Algorithm**: Generate maps based on specified content type percentages
- **Analysis Metrics**: View distribution statistics and warnings
- **Export Functionality**: Export the generated map as a PNG image

## Getting Started

### Prerequisites

- Node.js 18.x or newer
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd map-visualization-tool
   ```

2. Install dependencies:
   ```
   npm install
   ```

### Running the Application

#### Development Mode

Start the development server:
```
npm run dev
```

This will start the Vite development server at http://localhost:5173.

#### Production Build

Build the application for production:
```
npm run build
```

Preview the production build:
```
npm run preview
```

### Static Demo

For a quick preview without running the development server, open:
- `static-demo.html` - A static HTML demo of the interface
- `simple-viewer.html` - Documentation and overview

## Project Structure

```
mvp-simple/
├── src/                 # Source code
│   ├── App.tsx          # Main application component
│   ├── App.css          # Application styles
│   ├── main.tsx         # Application entry point
│   ├── index.css        # Global styles
│   └── types.d.ts       # TypeScript type definitions
├── public/              # Static assets
├── scripts/             # Utility scripts
│   └── check-versions.js # Dependency compatibility checker
├── index.html           # HTML entry point
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.js       # Vite configuration
├── postcss.config.js    # PostCSS configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── VERSION.md           # Version compatibility documentation
└── README.md            # Project documentation
```

## Configuration Files

This project uses CommonJS format for all configuration files:
- `vite.config.js`
- `postcss.config.js`
- `tailwind.config.js`

## Version Compatibility

This project uses pinned dependency versions to ensure compatibility:
- React 19.0.0
- TypeScript 5.8.2
- Vite 6.2.0

For more details on version compatibility, see [VERSION.md](./VERSION.md).

## Dependency Verification

The project includes a dependency compatibility checker that runs automatically during installation:

```
npm run check-versions
```

This script verifies that all dependencies are compatible with each other and that configuration files use consistent module formats.

## Technologies Used

- **React**: A JavaScript library for building user interfaces
- **TypeScript**: A typed superset of JavaScript
- **Vite**: A fast build tool and development server
- **Tailwind CSS**: A utility-first CSS framework
- **HTML5 Canvas API**: For drawing the grid and map visualization

## Future Enhancements

- Advanced content distribution algorithms
- Biome generation with adjacency rules
- Interactive editing of the generated map
- Additional export formats
- Saving and loading map configurations
- Undo/redo functionality
