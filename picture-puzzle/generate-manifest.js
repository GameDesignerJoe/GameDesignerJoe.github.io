// Generate image manifest for Picture Puzzler
// Run this script whenever you add new images to sample-pics folder
// Usage: node generate-manifest.js

const fs = require('fs');
const path = require('path');

const samplePicsDir = path.join(__dirname, 'sample-pics');
const outputFile = path.join(__dirname, 'gallery-manifest.js');

// Valid image extensions
const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];

try {
    // Read all files in sample-pics directory
    const files = fs.readdirSync(samplePicsDir);
    
    // Filter for image files only
    const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
    }).sort(); // Sort alphabetically
    
    // Create JavaScript file content that defines a global variable
    const jsContent = `// Auto-generated gallery manifest
// Generated: ${new Date().toISOString()}
// Count: ${imageFiles.length} images

window.PUZZLE_GALLERY_IMAGES = ${JSON.stringify(imageFiles, null, 2)};
`;
    
    // Write JavaScript file
    fs.writeFileSync(outputFile, jsContent);
    
    console.log('✅ Manifest generated successfully!');
    console.log(`📁 Found ${imageFiles.length} images`);
    console.log(`📄 Manifest saved to: ${outputFile}`);
    console.log('\nImages found:');
    imageFiles.forEach((img, index) => {
        console.log(`  ${index + 1}. ${img}`);
    });
    
} catch (error) {
    console.error('❌ Error generating manifest:', error.message);
    process.exit(1);
}
