# Map Visualization Tool - Pre-MVP

This is a pre-MVP implementation to validate the development environment and technical foundation for the Map Visualization Tool project.

## Purpose

The purpose of this pre-MVP is to:

1. Validate that React with Vite works correctly in the development environment
2. Test TypeScript integration
3. Verify Tailwind CSS setup
4. Test Canvas API functionality
5. Verify state management

## Technologies Used

- **React**: A JavaScript library for building user interfaces
- **TypeScript**: A typed superset of JavaScript
- **Vite**: A fast build tool and development server
- **Tailwind CSS**: A utility-first CSS framework
- **HTML5 Canvas API**: For drawing graphics and visualizations

## Project Structure

```
pre-mvp/
├── public/              # Static assets
├── src/                 # Source code
│   ├── components/      # React components
│   │   └── CanvasTest.tsx  # Canvas API test component
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles with Tailwind directives
├── .gitignore           # Git ignore file
├── index.html           # HTML entry point
├── package.json         # Project dependencies and scripts
├── postcss.config.js    # PostCSS configuration for Tailwind
├── tailwind.config.js   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite configuration
```

## Features Tested

1. **React Setup**: Basic React component rendering and state management
2. **TypeScript Integration**: Type checking and TypeScript syntax
3. **Tailwind CSS**: Utility classes for styling
4. **Canvas API**: Drawing shapes and implementing a grid system
5. **Component Composition**: Parent-child component relationships

## Running the Project

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Open your browser and navigate to the URL shown in the terminal (typically http://localhost:5173)

## Next Steps

After validating that all technologies work correctly in the development environment, we can proceed with implementing the full Map Visualization Tool as outlined in the implementation plan.
