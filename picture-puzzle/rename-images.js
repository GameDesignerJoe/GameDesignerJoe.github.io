const fs = require('fs');
const path = require('path');

const samplePicsDir = path.join(__dirname, 'sample-pics');

// Get all image files
const files = fs.readdirSync(samplePicsDir)
    .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    })
    .sort(); // Sort alphabetically for consistent numbering

console.log(`Found ${files.length} images to rename\n`);

// Rename each file
files.forEach((file, index) => {
    const ext = path.extname(file);
    const paddedNumber = String(index + 1).padStart(3, '0');
    const newName = `pp_${paddedNumber}${ext}`;
    
    const oldPath = path.join(samplePicsDir, file);
    const newPath = path.join(samplePicsDir, newName);
    
    try {
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Renamed: ${file} → ${newName}`);
    } catch (err) {
        console.error(`❌ Error renaming ${file}:`, err.message);
    }
});

console.log(`\n✅ Renaming complete! All ${files.length} images renamed.`);
console.log('🔄 Now run: node generate-manifest.js');
