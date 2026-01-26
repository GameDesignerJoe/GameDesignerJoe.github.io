// Ship Life - Map System

/**
 * Load and render the map room
 */
function loadMapRoom() {
    const planets = window.planetsData || [];
    const locations = window.locationsData || [];
    
    if (planets.length === 0 || locations.length === 0) {
        console.error('Map data not loaded');
        return;
    }
    
    // For Phase 1, just use the first planet (Earth)
    const planet = planets[0];
    const planetLocations = locations.filter(loc => loc.planet_id === planet.id);
    
    console.log(`Loading map for ${planet.name} with ${planetLocations.length} locations`);
    
    renderPlanetMap(planet, planetLocations);
}

/**
 * Render planet map with hotspots
 */
function renderPlanetMap(planet, locations) {
    const container = document.getElementById('room-container');
    container.innerHTML = '';
    container.className = 'map-room-container';
    
    // Create map background
    const mapBackground = document.createElement('div');
    mapBackground.className = 'map-background';
    
    // Use color background for now (Phase 1 - no image yet)
    mapBackground.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
    mapBackground.style.position = 'relative';
    mapBackground.style.width = '100%';
    mapBackground.style.height = '80vh';
    mapBackground.style.borderRadius = '12px';
    mapBackground.style.overflow = 'hidden';
    
    // Add planet name overlay
    const planetTitle = document.createElement('div');
    planetTitle.style.position = 'absolute';
    planetTitle.style.top = '20px';
    planetTitle.style.left = '50%';
    planetTitle.style.transform = 'translateX(-50%)';
    planetTitle.style.fontSize = '32px';
    planetTitle.style.fontWeight = '700';
    planetTitle.style.color = 'rgba(255, 255, 255, 0.9)';
    planetTitle.style.textShadow = '2px 2px 8px rgba(0, 0, 0, 0.8)';
    planetTitle.textContent = planet.name;
    mapBackground.appendChild(planetTitle);
    
    // Create hotspots for each location
    locations.forEach(location => {
        const hotspot = createHotspot(location);
        mapBackground.appendChild(hotspot);
    });
    
    // Create sidebar (initially hidden)
    const sidebar = createLocationSidebar();
    
    container.appendChild(mapBackground);
    container.appendChild(sidebar);
}

/**
 * Create a hotspot pin for a location
 */
function createHotspot(location) {
    const hotspot = document.createElement('div');
    hotspot.className = 'hotspot-pin';
    
    // Position using percentage-based coordinates
    hotspot.style.left = `${location.hotspot_position.x}%`;
    hotspot.style.top = `${location.hotspot_position.y}%`;
    
    // Check if location is unlocked
    const isUnlocked = checkLocationUnlock(location, gameState);
    
    if (!isUnlocked) {
        hotspot.classList.add('locked');
    }
    
    // Create pin circle
    const circle = document.createElement('div');
    circle.className = 'hotspot-circle';
    
    // Create pin line
    const line = document.createElement('div');
    line.className = 'hotspot-line';
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'hotspot-tooltip';
    tooltip.textContent = location.name;
    if (!isUnlocked) {
        tooltip.textContent += ' (Locked)';
    }
    
    hotspot.appendChild(circle);
    hotspot.appendChild(line);
    hotspot.appendChild(tooltip);
    
    // Click handler
    hotspot.onclick = () => showLocationSidebar(location, isUnlocked);
    
    return hotspot;
}

/**
 * Check if location is unlocked
 */
function checkLocationUnlock(location, gameState) {
    if (!location.locked) {
        return true;
    }
    
    // Initialize progression if not exists
    if (!gameState.progression) {
        gameState.progression = {
            total_drops: 0,
            successful_drops: 0,
            failed_drops: 0,
            activities_completed: {}
        };
    }
    
    const reqs = location.unlock_requirements;
    const prog = gameState.progression;
    
    // Check drop count
    if (reqs.drop_count && prog.successful_drops < reqs.drop_count) {
        return false;
    }
    
    // Check total activities completed
    const totalActivities = prog.activities_completed._total || 0;
    if (reqs.activities_completed && totalActivities < reqs.activities_completed) {
        return false;
    }
    
    // Check specific activities
    if (reqs.specific_activities && reqs.specific_activities.length > 0) {
        for (const activityId of reqs.specific_activities) {
            if (!prog.activities_completed[activityId]) {
                return false;
            }
        }
    }
    
    return true;
}

/**
 * Create location sidebar
 */
function createLocationSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'location-sidebar';
    sidebar.className = 'location-sidebar hidden';
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sidebar-close-btn';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => {
        sidebar.classList.add('hidden');
    };
    sidebar.appendChild(closeBtn);
    
    // Content container
    const content = document.createElement('div');
    content.id = 'location-sidebar-content';
    sidebar.appendChild(content);
    
    return sidebar;
}

/**
 * Show location sidebar with details
 */
function showLocationSidebar(location, isUnlocked) {
    const sidebar = document.getElementById('location-sidebar');
    const content = document.getElementById('location-sidebar-content');
    
    content.innerHTML = '';
    
    // Location image placeholder
    const imagePlaceholder = document.createElement('div');
    imagePlaceholder.style.width = '100%';
    imagePlaceholder.style.height = '200px';
    imagePlaceholder.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    imagePlaceholder.style.borderRadius = '8px';
    imagePlaceholder.style.marginBottom = '20px';
    imagePlaceholder.style.display = 'flex';
    imagePlaceholder.style.alignItems = 'center';
    imagePlaceholder.style.justifyContent = 'center';
    imagePlaceholder.style.fontSize = '18px';
    imagePlaceholder.style.fontWeight = '600';
    imagePlaceholder.style.color = 'rgba(255, 255, 255, 0.8)';
    imagePlaceholder.textContent = location.name;
    
    if (!isUnlocked) {
        imagePlaceholder.style.filter = 'grayscale(100%)';
        imagePlaceholder.style.opacity = '0.5';
    }
    
    // Location name
    const name = document.createElement('h2');
    name.style.fontSize = '28px';
    name.style.fontWeight = '700';
    name.style.marginBottom = '12px';
    name.textContent = location.name;
    
    // Description
    const description = document.createElement('p');
    description.style.fontSize = '16px';
    description.style.lineHeight = '1.6';
    description.style.marginBottom = '20px';
    description.style.color = 'rgba(255, 255, 255, 0.85)';
    description.textContent = location.description;
    
    content.appendChild(imagePlaceholder);
    content.appendChild(name);
    content.appendChild(description);
    
    if (isUnlocked) {
        // Possible resources
        if (location.possible_resources && location.possible_resources.length > 0) {
            const resourcesTitle = document.createElement('h3');
            resourcesTitle.style.fontSize = '18px';
            resourcesTitle.style.fontWeight = '600';
            resourcesTitle.style.marginTop = '20px';
            resourcesTitle.style.marginBottom = '10px';
            resourcesTitle.textContent = 'Possible Resources';
            
            const resourcesList = document.createElement('ul');
            resourcesList.style.paddingLeft = '20px';
            resourcesList.style.lineHeight = '1.8';
            
            location.possible_resources.forEach(resource => {
                const li = document.createElement('li');
                li.textContent = resource.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                resourcesList.appendChild(li);
            });
            
            content.appendChild(resourcesTitle);
            content.appendChild(resourcesList);
        }
        
        // Drop Here button
        const dropBtn = document.createElement('button');
        dropBtn.className = 'primary-button';
        dropBtn.textContent = 'Drop Here';
        dropBtn.style.marginTop = '30px';
        dropBtn.style.width = '100%';
        dropBtn.style.padding = '15px';
        dropBtn.style.fontSize = '18px';
        dropBtn.onclick = () => selectLocation(location);
        
        content.appendChild(dropBtn);
    } else {
        // Show unlock requirements
        const reqTitle = document.createElement('h3');
        reqTitle.style.fontSize = '18px';
        reqTitle.style.fontWeight = '600';
        reqTitle.style.marginTop = '20px';
        reqTitle.style.marginBottom = '10px';
        reqTitle.style.color = 'var(--error)';
        reqTitle.textContent = 'Unlock Requirements';
        
        const reqList = document.createElement('ul');
        reqList.style.paddingLeft = '20px';
        reqList.style.lineHeight = '1.8';
        reqList.style.color = 'rgba(255, 255, 255, 0.7)';
        
        const reqs = location.unlock_requirements;
        const prog = gameState.progression || { successful_drops: 0, activities_completed: {} };
        
        if (reqs.drop_count > 0) {
            const li = document.createElement('li');
            li.textContent = `Complete ${reqs.drop_count} successful drops (${prog.successful_drops}/${reqs.drop_count})`;
            reqList.appendChild(li);
        }
        
        if (reqs.activities_completed > 0) {
            const totalActivities = prog.activities_completed._total || 0;
            const li = document.createElement('li');
            li.textContent = `Complete ${reqs.activities_completed} total activities (${totalActivities}/${reqs.activities_completed})`;
            reqList.appendChild(li);
        }
        
        content.appendChild(reqTitle);
        content.appendChild(reqList);
    }
    
    sidebar.classList.remove('hidden');
}

/**
 * Select a location and proceed to planetfall
 */
function selectLocation(location) {
    console.log('Selected location:', location.name);
    
    // Store selected location in window for access in planetfall
    window.selectedLocation = location;
    
    // Spawn activities for this location
    const activities = spawnActivities(location);
    window.selectedLocation.spawnedActivities = activities;
    
    // Navigate to planetfall portal
    switchRoom('planetfall_portal');
}

console.log('Map system loaded.');
