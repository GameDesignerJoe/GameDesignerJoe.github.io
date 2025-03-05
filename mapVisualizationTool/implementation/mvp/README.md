# Map Visualization Tool - MVP

This is the MVP (Minimum Viable Product) implementation of the Map Visualization Tool, a web application for creating and visualizing map content distributions using a hexagonal grid system.

## Features

- **Three-Panel Interface**: Input Panel, Map Visualization Panel, and Analysis Panel
- **Map Configuration**: Set width, height, and hex size for the map
- **Content Type Management**: Create, edit, and remove content types with custom colors and distribution percentages
- **Hexagonal Grid Visualization**: View the generated map with a hexagonal grid
- **Content Distribution Algorithm**: Generate maps based on specified content type percentages
- **Analysis Metrics**: View distribution statistics and warnings
- **Export Functionality**: Export the generated map as a PNG image

## Technologies Used

- **React**: A JavaScript library for building user interfaces
- **TypeScript**: A typed superset of JavaScript
- **Vite**: A fast build tool and development server
- **HTML5 Canvas API**: For drawing the hexagonal grid and map visualization

## Project Structure

```
mvp/
├── public/              # Static assets
├── src/                 # Source code
│   ├── components/      # React components
│   │   ├── InputPanel/  # Input panel component
│   │   ├── MapPanel/    # Map visualization panel component
│   │   └── AnalysisPanel/ # Analysis panel component
│   ├── App.tsx          # Main application component
│   ├── App.css          # Application styles
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles
├── index.html           # HTML entry point
├── package.json         # Project dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── README.md            # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies:
   ```
   npm install
   ```

### Running the Application

1. Start the development server:
   ```
   npm run dev
   ```
2. Open your browser and navigate to the URL shown in the terminal (typically http://localhost:5173)

### Building for Production

1. Build the application:
   ```
   npm run build
   ```
2. The built files will be in the `dist` directory

## Usage

1. Configure the map dimensions and hex size in the Input Panel
2. Define content types with names, colors, and distribution percentages (must total 100%)
3. Click "Generate Map" to create a visualization
4. View the generated map in the Map Visualization Panel
5. Analyze the content distribution and metrics in the Analysis Panel
6. Export the map as a PNG image if desired

## Implementation Details

### Content Distribution Algorithm

The current implementation uses a simple random distribution algorithm that attempts to match the requested percentages for each content type. Future versions could implement more sophisticated algorithms such as:

- Clustering algorithms for more realistic terrain generation
- Noise-based generation (e.g., Perlin noise)
- Rule-based generation with adjacency constraints

### Hexagonal Grid System

The map uses a hexagonal grid system with an offset coordinate system. Each hexagon represents a cell that can contain one type of content. The grid is rendered using the HTML5 Canvas API.

## Future Enhancements

- Advanced content distribution algorithms
- Biome generation with adjacency rules
- Interactive editing of the generated map
- Additional export formats
- Saving and loading map configurations
- Undo/redo functionality
