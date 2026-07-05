const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        if (['node_modules', '.next', '.git', 'dist'].includes(f)) return;
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            walkDir(dirPath);
        } else {
            let ext = path.extname(f);
            if (f.endsWith('.md') || f.endsWith('.txt')) {
                fs.unlinkSync(dirPath);
                console.log(`Deleted: ${dirPath}`);
            }
        }
    });
}

walkDir(path.join(__dirname, 'frontend'));
walkDir(path.join(__dirname, 'backend'));
console.log('Markdown and text files removed.');
