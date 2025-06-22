# Minecraft 1.21.6 Fabric Development - Lessons Learned

## Overview
This document outlines the key differences and lessons learned while implementing the Journal Mod for Minecraft 1.21.6, compared to the original design document assumptions.

## Critical API Changes in Minecraft 1.21.6

### 1. Block Registration System Changes

**Original Design Assumption:**
- Blocks could be initialized directly as static fields
- Registration would happen automatically or during mod initialization

**Reality in 1.21.6:**
- **Blocks must be registered BEFORE any initialization attempts**
- Block IDs are null until properly registered with the registry system
- Attempting to create blocks without registration causes `NullPointerException: Block id not set`

**Solution Required:**
```java
// WRONG - Causes crash
public static final Block TEST_BLOCK = new TestBlock(settings);

// CORRECT - Register first, then reference
static {
    TEST_BLOCK = Registry.register(Registries.BLOCK, identifier, new TestBlock(settings));
}
```

### 2. Material System Removal

**Original Design Assumption:**
- Use `Material.WOOD` for block properties
- Material class handles visual and audio properties

**Reality in 1.21.6:**
- **`Material` class has been completely removed**
- Block properties are now split into separate concerns:
  - `MapColor` for visual representation on maps
  - `BlockSoundGroup` for audio properties
  - Individual methods for hardness, resistance, etc.

**Migration Required:**
```java
// OLD (doesn't work in 1.21.6)
.material(Material.WOOD)

// NEW (required in 1.21.6)
.mapColor(MapColor.BROWN)
.sounds(BlockSoundGroup.WOOD)
```

### 3. Identifier Creation Method Change

**Original Design Assumption:**
- Use `new Identifier(namespace, path)` constructor

**Reality in 1.21.6:**
- **Constructor has been replaced with static factory method**
- `new Identifier()` causes compilation errors
- Must use `Identifier.of()` instead

**Required Change:**
```java
// OLD (compilation error in 1.21.6)
new Identifier(MOD_ID, "test_block")

// NEW (required in 1.21.6)
Identifier.of(MOD_ID, "test_block")
```

## Development Environment Implications

### Updated Required Imports
The following imports are now required that weren't in the original design:

```java
import net.minecraft.block.MapColor;           // Replaces Material
import net.minecraft.sound.BlockSoundGroup;    // For block sounds
// Note: Material import will cause compilation errors
```

### Registration Order Criticality
- **Block registration must happen in static initialization blocks**
- Cannot defer registration to `onInitialize()` method
- Both block AND corresponding BlockItem must be registered
- Registration order matters for dependency resolution

## Updated Phase 0 Implementation Steps

**Original Phase 0:**
1. Set up development environment
2. Create basic mod structure
3. Implement simple "Hello World" block

**Revised Phase 0 (Based on 1.21.6 Reality):**
1. Set up development environment with JDK 21
2. Create Fabric mod template
3. **Learn 1.21.6 API differences** (this step was missing!)
4. Implement proper block registration system
5. Handle Material → MapColor/BlockSoundGroup migration
6. Update Identifier creation to use factory methods
7. Test basic block functionality

## Error Patterns to Watch For

### 1. Runtime Crashes During Initialization
**Symptom:** `NullPointerException: Block id not set`
**Cause:** Attempting to use unregistered blocks
**Solution:** Always register before using

### 2. Compilation Errors on Material
**Symptom:** `The import net.minecraft.block.Material cannot be resolved`
**Cause:** Material class removed in 1.21.6
**Solution:** Use MapColor and BlockSoundGroup instead

### 3. Registry Method Signature Errors
**Symptom:** Type parameter errors on `Registry.register()`
**Cause:** Using old Identifier constructor
**Solution:** Use `Identifier.of()` factory method

## Recommendations for Future Development

### 1. Version-Specific Research Phase
- Add explicit research phase for each Minecraft version
- Check migration guides before starting development
- Test basic registration patterns before complex features

### 2. Updated Development Workflow
1. **Always start with minimal registration example**
2. Verify block registration works before adding features
3. Test compilation and runtime separately
4. Use IDE error highlighting to catch API changes early

### 3. Documentation Strategy
- Keep version-specific notes for API changes
- Document working examples for each Minecraft version
- Maintain migration guides between versions

## Impact on Original Design Timeline

**Original Phase 0 Estimate:** 1-2 days for basic setup
**Actual Phase 0 Reality:** 2-3 days including API migration learning

**Key Lesson:** Budget additional time for API changes when working with newer Minecraft versions, especially major releases like 1.21.x series.

## Positive Discoveries

### 1. Improved API Design
- New block settings system is more explicit and clear
- Separation of concerns (visual vs audio properties) is better architecture
- Static factory methods provide better validation

### 2. Better Error Messages
- Compilation errors clearly indicate missing/changed classes
- Runtime errors provide specific context about registration issues

### 3. Development Environment
- Fabric development environment setup remains straightforward
- IDE integration still excellent for catching issues early

## Next Phase Considerations

For Phase 1 (Core Mechanics), we now know to:
- Implement block interaction using updated event handling APIs
- Verify GUI/screen APIs haven't changed significantly
- Test player data persistence with current world format
- Confirm recipe registration follows similar patterns to block registration

## Conclusion

While the core design concepts remain valid, Minecraft 1.21.6 requires significant API migration compared to earlier versions. The most critical lesson is that **registration-before-use** is now strictly enforced, and the Material system removal requires updating all block creation code.

Future phases should proceed with awareness that similar API changes may affect other systems (items, recipes, world generation, etc.).