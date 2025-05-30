# Fellowship Map Content Visualization Tool - Component Inventory

| Component ID | Component Name | Panel | Purpose | Properties | Interactions | Implementation Notes |
|--------------|----------------|-------|---------|------------|--------------|---------------------|
| **MAP-CONFIG-01** | Reset Map Button | Input | Reset map to initial state | - State (enabled/disabled) | - Resets map configuration to defaults | - Primary reset action<br>- Returns all settings to default values |
| **MAP-CONFIG-02** | Map Area Input | Input | Set map area in km² | - Value (number)<br>- Range (1-50km²)<br>- Step: 0.1<br>- Default: 1km² | - Updates map configuration<br>- Recalculates grid | - Affects generation time<br>- Influences content density |
| **MAP-CONFIG-03** | Show Grid Toggle | Input | Show/hide square grid | - State (boolean)<br>- Default: true | - Toggles grid visibility | - Visual aid only<br>- Grid only shows on non-transparent portions of the map |
| **MAP-CONFIG-04** | Grid Color Picker | Input | Set grid line color | - Color value (hex)<br>- Default: #666666 | - Updates grid color | - Color picker with hex input<br>- Matches theme styling |
| **MAP-CONFIG-05** | Grid Opacity Slider | Input | Control grid transparency | - Value (0-100%)<br>- Default: 50% | - Updates grid opacity | - Real-time visual feedback<br>- Affects grid visibility |
| **MAP-CONFIG-06** | Detail Level Display | Input | Show current detail level | - Current level<br>- Scale info<br>- Area info | - Updates with zoom changes | - Shows cell size in meters<br>- Displays current/target area |
| **CT-LIST-01** | Content Type List | Input | Display defined content types | - Content types array<br>- Selection state | - Scrollable list<br>- Click to select | - Shows content type summary<br>- Visual indicators for color/shape |
| **CT-FORM-01** | New Content Button | Input | Create new content type | - State (active/inactive) | - Opens empty content form<br>- Clears selection | - Prominent position for discoverability |
| **CT-FORM-02** | Content Type Form | Input | Edit content properties | - Content type data<br>- Edit/create mode | - Input validation<br>- Save changes<br>- Cancel editing | - Provides fields for all content properties<br>- Adapts based on category |
| **CT-FORM-03** | Name Field | Input | Set content type name | - Text value<br>- Required field | - Updates content name | - Must be unique |
| **CT-FORM-04** | Category Selector | Input | Set content category | - Options list<br>- Selected option | - Updates content category<br>- May show/hide category-specific fields | - Influences visual representation<br>- Affects analysis grouping |
| **CT-FORM-05** | Color Picker | Input | Set content color | - Color value (hex)<br>- Default based on category | - Updates color<br>- Manual hex input | - Visual differentiation<br>- Used in map visualization |
| **CT-FORM-06** | Shape Selector | Input | Set visual shape | - Options (circle, square, hexagon, irregular)<br>- Selected option | - Updates shape | - Affects visual representation<br>- May influence placement algorithm |
| **CT-FORM-07** | Size Input | Input | Set content size | - Value (number)<br>- Range based on category<br>- Units in meters | - Updates size<br>- Recalculates pixel size | - Real-world measurements in meters<br>- Scales with zoom level<br>- Affects spacing and overlap calculations |
| **CT-FORM-08** | Quantity Input | Input | Set instance count | - Value (number)<br>- Range (1-1000) | - Updates quantity | - Affects generation time<br>- Total count analysis |
| **CT-FORM-09** | Min Spacing Input | Input | Set proximity rules | - Value (number)<br>- Range (0-1000m) | - Updates spacing rule | - Minimum distance between same type<br>- Affects distribution pattern |
| **CT-FORM-10** | Can Overlap Toggle | Input | Set overlap permission | - State (boolean)<br>- Default: false | - Updates overlap rule | - Affects collision detection<br>- Influences placement success rate |
| **CT-FORM-11** | Allowed Biomes Selector | Input | Set biome restrictions | - Options list<br>- Selected options | - Updates biome rules | - Multi-select<br>- Limits valid placement locations |
| **CT-FORM-12** | Cancel Button | Input | Exit form | - State (enabled/disabled) | - Closes form<br>- Discards changes | - Returns to content type list |
| **CT-FORM-13** | Create/Update Button | Input | Save content type | - Label (based on mode)<br>- State (enabled/disabled) | - Validates form<br>- Saves changes<br>- Updates content list | - Primary action<br>- Disabled if validation fails |
| **GEN-01** | Generate Map Button | Input | Run distribution algorithm | - State (enabled/processing/disabled) | - Triggers content generation<br>- Updates visualization and analysis | - Primary action button<br>- Shows processing state |
| **MAP-01** | Map Canvas | Visualization | Display content visualization | - Canvas context<br>- Scale/dimensions<br>- Generated content data<br>- Normalized coordinate system (0-1)<br>- Real-world measurements (meters) | - Visual representation of all content<br>- Pan/zoom with coordinate transformation<br>- Pixel-perfect rendering | - HTML5 Canvas<br>- Uses normalized coordinates for content positions<br>- Maintains content positions across zoom levels<br>- Efficient rendering with transparency validation |
| **MAP-02** | Square Grid Overlay | Visualization | Show scale reference | - Visibility<br>- Cell size<br>- Color/opacity<br>- Transparency mask | - Visual grid<br>- Adapts to zoom level | - Creates square pattern<br>- Only visible on non-transparent portions of the map<br>- Uses transparency validation<br>- Integer-aligned coordinates |
| **MAP-03** | Map Navigation | Visualization | Control map view | - Pan state<br>- Zoom level (0.5x to 8.0x)<br>- Reset button<br>- Coordinate transformation system | - Click and drag to pan<br>- Mouse wheel to zoom<br>- Reset to initial view<br>- Maintains content positions | - Cursor changes for pan<br>- Maintains point under cursor while zooming<br>- Bounds checking for pan limits<br>- Uses mapToScreenCoordinates for position calculations |
| **MAP-04** | Detail Level Display | Visualization | Show current scale | - Current detail level<br>- Scale representation<br>- Cell size information | - Updates with zoom changes | - Shows cell size in meters<br>- Synchronized with zoom level<br>- Maximum zoom shows 10m cells |
| **MAP-05** | Export Button | Visualization | Save visualization | - State (enabled/processing) | - Generates PNG<br>- Triggers download | - Creates high-resolution image<br>- Includes all visible elements |
| **ANA-01** | Content Distribution Section | Analysis | Show content breakdown | - Content counts by category | - Read-only display | - Updates after generation<br>- Categorizes all placed content |
| **ANA-02** | Density Analysis Section | Analysis | Show space utilization | - Overall density<br>- Regional density | - Read-only display | - Calculates items per area<br>- Identifies high/low density regions |
| **ANA-03** | Travel Times Section | Analysis | Show player experience metrics | - Average/min/max travel times | - Read-only display | - Estimates based on player speed<br>- Measures content proximity |
| **ANA-04** | Warnings Section | Analysis | Highlight potential issues | - Warning list<br>- Severity | - Read-only display | - Identifies problems<br>- Suggests improvements |

## Relationships Between Components

### Data Flow Relationships
1. **Map Configuration → Generation**: Map size and grid settings influence the generation algorithm
2. **Content Types → Generation**: Content definitions determine what gets placed and how
3. **Generation → Map Canvas**: Generation results are visualized on the canvas using normalized coordinates
4. **Generation → Analysis**: Distribution results are analyzed for metrics and warnings

### UI Relationships
1. **Content Type List ↔ Content Type Form**: Selection in list populates form; changes in form update list
2. **Map Configuration → Map Canvas**: Size settings affect canvas dimensions and scale
3. **Generate Button → Map Canvas + Analysis**: Triggering generation updates both visualization and metrics
4. **Zoom Level ↔ Detail Level**: Zoom changes trigger coordinate transformations and grid scale adjustments
5. **Grid Color + Opacity → Grid Display**: Visual settings immediately reflect in grid appearance

### Functional Dependencies
1. **Map Canvas** depends on **Generate Button** to have content to display
2. **Analysis Panel** depends on **Generate Button** to have data to analyze
3. **Export Button** depends on **Map Canvas** having content to export
4. **Content Type Form** operation can depend on **Content Type List** selection
5. **Detail Level Display** depends on current zoom level and grid settings
6. **Grid Display** depends on transparency mask and grid settings
7. **Content Positions** depend on normalized coordinate system for zoom independence

## Implementation Priorities

### MVP Components (Phase 1)
- **MAP-CONFIG-01/02/03/04**: Basic map configuration
- **CT-LIST-01**: Simple content type list
- **CT-FORM-02/03/04/05/06/07/08**: Basic content type properties
- **GEN-01**: Generate button
- **MAP-01/02**: Basic map visualization with normalized coordinates
- **MAP-03**: Export functionality
- **ANA-01/02**: Basic analysis metrics

### Phase 2 Enhancements
- **CT-FORM-09/10/11**: Advanced distribution rules
- **ANA-03/04**: Advanced analysis and warnings
- Additional visualization options
- Content library management

### Phase 3 Extensions
- **MAP-03/04**: Enhanced zoom controls and coordinate transformation
- Interactive map manipulation
- Layer toggling for content types
- Enhanced visual representation

### Phase 4 Extensions
- Advanced analysis visualizations
- Custom export options
- Expanded content type properties
- Progression path visualization
