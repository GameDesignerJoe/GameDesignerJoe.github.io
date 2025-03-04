# Fellowship Map Content Visualization Tool - Component Inventory

| Component ID | Component Name | Panel | Purpose | Properties | Interactions | Implementation Notes |
|--------------|----------------|-------|---------|------------|--------------|---------------------|
| **MAP-CONFIG-01** | Map Width Input | Input | Set map horizontal size | - Value (number)<br>- Range (1-20km)<br>- Default: 6km | - Updates map configuration<br>- Triggers canvas resize | - Affects generation time<br>- Influences content density |
| **MAP-CONFIG-02** | Map Height Input | Input | Set map vertical size | - Value (number)<br>- Range (1-20km)<br>- Default: 4km | - Updates map configuration<br>- Triggers canvas resize | - Affects generation time<br>- Influences content density |
| **MAP-CONFIG-03** | Hex Size Input | Input | Set grid granularity | - Value (number)<br>- Range (5-50m)<br>- Default: 10m | - Updates grid visualization<br>- Influences placement precision | - Smaller values increase processing time<br>- Visual aid only, doesn't affect content placement |
| **MAP-CONFIG-04** | Show Grid Toggle | Input | Show/hide hex grid | - State (boolean)<br>- Default: true | - Toggles grid visibility | - Visual aid only |
| **CT-LIST-01** | Content Type List | Input | Display defined content types | - Content types array<br>- Selection state | - Scrollable list<br>- Click to select | - Shows content type summary<br>- Visual indicators for color/shape |
| **CT-FORM-01** | New Content Button | Input | Create new content type | - State (active/inactive) | - Opens empty content form<br>- Clears selection | - Prominent position for discoverability |
| **CT-FORM-02** | Content Type Form | Input | Edit content properties | - Content type data<br>- Edit/create mode | - Input validation<br>- Save changes<br>- Cancel editing | - Provides fields for all content properties<br>- Adapts based on category |
| **CT-FORM-03** | Name Field | Input | Set content type name | - Text value<br>- Required field | - Updates content name | - Must be unique |
| **CT-FORM-04** | Category Selector | Input | Set content category | - Options list<br>- Selected option | - Updates content category<br>- May show/hide category-specific fields | - Influences visual representation<br>- Affects analysis grouping |
| **CT-FORM-05** | Color Picker | Input | Set content color | - Color value (hex)<br>- Default based on category | - Updates color<br>- Manual hex input | - Visual differentiation<br>- Used in map visualization |
| **CT-FORM-06** | Shape Selector | Input | Set visual shape | - Options (circle, square, hexagon, irregular)<br>- Selected option | - Updates shape | - Affects visual representation<br>- May influence placement algorithm |
| **CT-FORM-07** | Size Input | Input | Set content size | - Value (number)<br>- Range based on category | - Updates size | - Measured in meters<br>- Affects spacing and overlap calculations |
| **CT-FORM-08** | Quantity Input | Input | Set instance count | - Value (number)<br>- Range (1-1000) | - Updates quantity | - Affects generation time<br>- Total count analysis |
| **CT-FORM-09** | Min Spacing Input | Input | Set proximity rules | - Value (number)<br>- Range (0-1000m) | - Updates spacing rule | - Minimum distance between same type<br>- Affects distribution pattern |
| **CT-FORM-10** | Can Overlap Toggle | Input | Set overlap permission | - State (boolean)<br>- Default: false | - Updates overlap rule | - Affects collision detection<br>- Influences placement success rate |
| **CT-FORM-11** | Allowed Biomes Selector | Input | Set biome restrictions | - Options list<br>- Selected options | - Updates biome rules | - Multi-select<br>- Limits valid placement locations |
| **CT-FORM-12** | Cancel Button | Input | Exit form | - State (enabled/disabled) | - Closes form<br>- Discards changes | - Returns to content type list |
| **CT-FORM-13** | Create/Update Button | Input | Save content type | - Label (based on mode)<br>- State (enabled/disabled) | - Validates form<br>- Saves changes<br>- Updates content list | - Primary action<br>- Disabled if validation fails |
| **GEN-01** | Generate Map Button | Input | Run distribution algorithm | - State (enabled/processing/disabled) | - Triggers content generation<br>- Updates visualization and analysis | - Primary action button<br>- Shows processing state |
| **MAP-01** | Map Canvas | Visualization | Display content visualization | - Canvas context<br>- Scale/dimensions<br>- Generated content data | - Visual representation of all content<br>- Optional: pan/zoom (future) | - HTML5 Canvas<br>- Needs efficient rendering for large maps |
| **MAP-02** | Hex Grid Overlay | Visualization | Show scale reference | - Visibility<br>- Hex size<br>- Color/opacity | - Visual grid | - Creates hexagonal pattern<br>- Scales with map size |
| **MAP-03** | Export Button | Visualization | Save visualization | - State (enabled/processing) | - Generates PNG<br>- Triggers download | - Creates high-resolution image<br>- Includes all visible elements |
| **ANA-01** | Content Distribution Section | Analysis | Show content breakdown | - Content counts by category | - Read-only display | - Updates after generation<br>- Categorizes all placed content |
| **ANA-02** | Density Analysis Section | Analysis | Show space utilization | - Overall density<br>- Regional density | - Read-only display | - Calculates items per area<br>- Identifies high/low density regions |
| **ANA-03** | Travel Times Section | Analysis | Show player experience metrics | - Average/min/max travel times | - Read-only display | - Estimates based on player speed<br>- Measures content proximity |
| **ANA-04** | Warnings Section | Analysis | Highlight potential issues | - Warning list<br>- Severity | - Read-only display | - Identifies problems<br>- Suggests improvements |

## Relationships Between Components

### Data Flow Relationships
1. **Map Configuration → Generation**: Map size and grid settings influence the generation algorithm
2. **Content Types → Generation**: Content definitions determine what gets placed and how
3. **Generation → Map Canvas**: Generation results are visualized on the canvas
4. **Generation → Analysis**: Distribution results are analyzed for metrics and warnings

### UI Relationships
1. **Content Type List ↔ Content Type Form**: Selection in list populates form; changes in form update list
2. **Map Configuration → Map Canvas**: Size settings affect canvas dimensions and scale
3. **Generate Button → Map Canvas + Analysis**: Triggering generation updates both visualization and metrics

### Functional Dependencies
1. **Map Canvas** depends on **Generate Button** to have content to display
2. **Analysis Panel** depends on **Generate Button** to have data to analyze
3. **Export Button** depends on **Map Canvas** having content to export
4. **Content Type Form** operation can depend on **Content Type List** selection

## Implementation Priorities

### MVP Components (Phase 1)
- **MAP-CONFIG-01/02/03/04**: Basic map configuration
- **CT-LIST-01**: Simple content type list
- **CT-FORM-02/03/04/05/06/07/08**: Basic content type properties
- **GEN-01**: Generate button
- **MAP-01/02**: Basic map visualization
- **MAP-03**: Export functionality
- **ANA-01/02**: Basic analysis metrics

### Phase 2 Enhancements
- **CT-FORM-09/10/11**: Advanced distribution rules
- **ANA-03/04**: Advanced analysis and warnings
- Additional visualization options
- Content library management

### Phase 3/4 Extensions
- Interactive map manipulation
- Advanced analysis visualizations
- Custom export options
- Expanded content type properties
