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

### Header Controls
Located at the top of the center panel:

- **Panel Title**: "Map Visualization"
- **Export PNG Button**: Allows designers to save the current map view as an image

### Map Canvas
The main content area displays:

- **Background Map**: Terrain visualization with biome coloring
- **Square Grid**: Optional overlay that represents the scale of the map (only visible on non-transparent portions of the map)
- **Content Visualization**: Visual representation of all placed content:
  - Biomes shown as large colored regions
  - POIs shown as medium-sized shapes
  - Encounters shown as small shapes
  - Color coding matches the content type definitions

### Zoom and Level of Detail Controls
Located at the bottom of the map canvas:

- **Zoom Level Display**: Shows the current zoom level (e.g., "Zoom: 1.5x")
- **Zoom Buttons**: 
  - Plus (+) button to zoom in
  - Minus (-) button to zoom out
  - Reset button to return to default zoom (1.0x)
- **Mouse Wheel Support**: Users can also zoom in/out using the mouse wheel
- **Detail Level Information**:
  - Current scale representation (e.g., "1 square = 5 meters")
  - Effective cell size in pixels
  - Detail level name (e.g., "High Detail (5m)")

### Level of Detail System
The visualization adapts based on zoom level to maintain usability with large maps:

- **High Detail Levels** (Zoomed In):
  - Ultra Detail (1m): Each cell represents 1 meter (zoom ≥ 2.5)
  - Very High Detail (2m): Each cell represents 2 meters (zoom 2.0-2.5)
  - High Detail (5m): Each cell represents 5 meters (zoom 1.5-2.0)

- **Medium Detail Levels**:
  - Medium Detail (10m): Each cell represents 10 meters (zoom 1.2-1.5)
  - Medium Detail (25m): Each cell represents 25 meters (zoom 1.0-1.2)
  - Medium Detail (50m): Each cell represents 50 meters (zoom 0.8-1.0)

- **Low Detail Levels** (Zoomed Out):
  - Low Detail (100m): Each cell represents 100 meters (zoom 0.6-0.8)
  - Low Detail (250m): Each cell represents 250 meters (zoom 0.4-0.6)
  - Very Low Detail (500m): Each cell represents 500 meters (zoom 0.2-0.4)
  - Minimal Detail (1km): Each cell represents 1 kilometer (zoom < 0.2)

As the user zooms in or out, the system automatically transitions between these detail levels, aggregating or expanding content as appropriate. This allows for efficient visualization of very large maps (up to 50 square km) while maintaining the ability to examine fine details when needed.

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
