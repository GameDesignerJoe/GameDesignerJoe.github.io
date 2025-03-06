# Fellowship Map Content Visualization Tool - UI Walkthrough

## Overview
The Map Content Visualization Tool provides game designers with a comprehensive interface for configuring, visualizing, and analyzing content distribution across the Fellowship game map. The interface consists of three primary panels:

1. **Input Panel** (Left)
2. **Map Visualization Panel** (Center)
3. **Analysis Panel** (Right)

## Input Panel

### Map Configuration Section
Located at the top of the left panel, this section allows designers to set fundamental map parameters:

- **Map Width (km)**: Numeric input for setting the horizontal dimension of the map
- **Map Height (km)**: Numeric input for setting the vertical dimension of the map
- **Visual Cell Size (px)**: Controls the visual size of grid cells (each cell always represents 1 meter in-game)
- **Show Grid**: Toggle checkbox to display or hide the grid overlay
- **Grid Opacity**: Slider to control the transparency of the grid

### Content Types Section
The main area of the left panel displays all defined content types and provides tools for creating and editing them:

- **Content Type List**: Scrollable list showing each content type with:
  - Color indicator
  - Name
  - Summary information (quantity, size, shape)
- **Add New Button**: Opens the content type form for creating a new type
- **Content Type Selection**: Clicking a content type selects it and displays its details in the form

### Content Type Form
Appears when adding a new content type or editing an existing one:

- **Basic Properties**:
  - Name field
  - Category dropdown (Biome, Point of Interest, Enemy Encounter, Activity, Restoration Location)
- **Visual Properties**:
  - Color picker with hex value input
  - Shape selector (circle, square, hexagon, irregular)
- **Spatial Properties**:
  - Size input in meters
  - Quantity input for number of instances
- **Distribution Rules**:
  - Minimum spacing in meters
  - Can overlap toggle
  - Allowed biomes multi-select
- **Form Controls**:
  - Cancel button to exit the form
  - Create/Update button to save changes

### Generate Button
Located at the bottom of the left panel, this button triggers the content distribution algorithm and updates the map visualization and analysis.

## Map Visualization Panel

### Map Controls
Located at the top of the center panel:

- **Panel Title**: "Map Visualization"
- **Reset Map Button**: Returns the map to its initial position and zoom level

### Map Canvas
The main content area displays:

- **Background Map**: Terrain visualization with biome coloring
- **Square Grid**: Optional overlay that represents the scale of the map:
  - Only visible on non-transparent portions of the map
  - Color customizable through color picker
  - Opacity adjustable through slider
- **Content Visualization**: Visual representation of all placed content:
  - Biomes shown as large colored regions
  - POIs shown as medium-sized shapes
  - Encounters shown as small shapes
  - Color coding matches the content type definitions

### Map Navigation
The map supports intuitive navigation controls:

- **Pan**: Click and drag to move around the map
  - Cursor changes to indicate when panning is available
  - Smooth movement with acceleration
  - Bounds checking to prevent over-panning
- **Zoom**: 
  - Mouse wheel to zoom in/out
  - Maintains point under cursor while zooming
  - Smooth transitions between detail levels
- **Reset**: "Reset Map" button returns to initial view and position

### Detail Level Display
Shows the current map scale and grid cell size:

- **Detail Level**: Shows current level (e.g., "Detail Level 0 (400m)")
- **Grid Scale**: Each cell represents a specific real-world distance:
  - Level 0: 400m per cell (0.5x zoom)
  - Level 1: 200m per cell (1.0x zoom)
  - Level 2: 100m per cell (2.0x zoom)
  - Level 3: 50m per cell (4.0x zoom)
  - Level 4: 10m per cell (8.0x zoom)

### Level of Detail System
The visualization adapts based on zoom level to maintain usability with large maps:

The detail level system automatically adjusts the grid cell size based on the current zoom level:

1. **Zoom and Grid Relationship**:
   - Image zoom and grid size are synchronized
   - Grid cells scale proportionally with map zoom
   - Maximum zoom shows 10m grid cells for precise measurement
   - Smooth transitions between detail levels

2. **Detail Levels**:
   - Level 0 (0.5x zoom): 400m cells for overview
   - Level 1 (1.0x zoom): 200m cells for regions
   - Level 2 (2.0x zoom): 100m cells for areas
   - Level 3 (4.0x zoom): 50m cells for details
   - Level 4 (8.0x zoom): 10m cells for precise work

3. **Visual Feedback**:
   - Detail level name updates automatically
   - Grid lines maintain consistent visibility
   - Cell size shown in meters for easy reference
   - Grid only appears on map content (transparent areas excluded)

This system ensures efficient visualization of large maps while maintaining precise control at higher zoom levels. The synchronized zoom and grid relationship makes it easy to understand the scale at any zoom level.

### Content Representation
Each content type is represented according to its defined properties:

- **Shape**: Matches the selected shape (circle, square, hexagon, irregular)
- **Color**: Uses the defined color from the content type
- **Size**: Scaled according to the defined size and map scale
- **Positioning**: Distributed according to the algorithm and placement rules

## Analysis Panel

### Content Distribution Section
Shows quantitative breakdown of content by category:

- **Category Counts**: Lists each content category with total items placed
- **Visual Distribution**: Could be enhanced with a pie or bar chart in future versions

### Density Analysis Section
Provides metrics on content density across the map:

- **Overall Density**: Average items per 100 square meters across the entire map
- **Regional Breakdown**: Density measurements for different regions (North, East, South, West)
- **Density Visualization**: Could be enhanced with a heat map in future versions

### Travel Times Section
Estimates player experience metrics related to content spacing:

- **Average Travel Time**: Typical time between content encounters
- **Longest Gap**: Maximum travel time between any adjacent content
- **Shortest Gap**: Minimum travel time between any adjacent content
- **Travel Paths**: Could be enhanced with path visualization in future versions

### Warnings Section
Highlights potential issues with the current content distribution:

- **Warning Cards**: Yellow-bordered boxes describing identified problems
- **Warning Types**: Include density issues, clustering problems, and placement failures
- **Actionable Suggestions**: Provides guidance on how to address identified issues

## Interaction Flows

### Configuring the Map
1. Designer sets map dimensions and grid parameters
2. Toggles grid visibility as needed
3. Clicks "Generate Map" to see changes reflected in visualization

### Managing Content Types
1. Designer clicks "Add New" to create a content type
2. Fills out the form with desired properties
3. Clicks "Create" to add it to the content library
4. Can later select any content type to edit its properties

### Visualizing Content
1. After configuring map and content types, designer clicks "Generate Map"
2. System distributes content according to rules and constraints
3. Map visualization updates to show the new distribution
4. Analysis panel updates with metrics and warnings

### Iterating on Design
1. Designer reviews analysis and identifies issues
2. Adjusts content type properties or quantities
3. Regenerates the map to see the impact of changes
4. Repeats until satisfied with the distribution
5. Exports the visualization for sharing with the team

## Visual Design Elements

### Color Scheme
- **UI Framework**: Clean, light interface with white panels and subtle borders
- **Content Types**: Vibrant, distinguishable colors for different content categories
- **Analysis Elements**: Yellow for warnings, neutral grays for metrics, blue for interactive elements

### Typography
- **Headings**: Bold, clear section headers
- **Data Points**: Medium weight for metrics and key values
- **Explanatory Text**: Regular weight for descriptions and labels

### Layout
- **Three-Column Design**: Balanced layout with input, visualization, and analysis
- **Scrollable Sections**: Accommodates varying amounts of content while maintaining structure
- **Responsive Elements**: Form adapts to different input types and states
