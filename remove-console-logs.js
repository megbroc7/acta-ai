#!/usr/bin/env node

/**
 * This script removes console.log statements and fixes other common 
 * ESLint issues in the frontend code.
 * 
 * Usage: node remove-console-logs.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to process
const DIRECTORIES = [
  'frontend/src/pages',
  'frontend/src/components',
  'frontend/src/hooks',
  'frontend/src/services',
  'frontend/src/utils'
];

// File extensions to process
const FILE_EXTENSIONS = ['.js', '.jsx'];

// Function to recursively get all files in a directory
function getFilesInDirectory(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recursively process subdirectories
      files = files.concat(getFilesInDirectory(fullPath));
    } else if (FILE_EXTENSIONS.includes(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Function to remove console.log statements from a file
function processFile(filePath) {
  console.log(`Processing ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Remove console.log statements
  content = content.replace(/console\.log\([^)]*\);?/g, '');
  
  // Fix unnecessary escape characters in regular expressions
  // This is more complex and might need manual review
  
  // Remove unused variables
  // This is complex and should be done carefully - we'll only log these for manual fixing
  
  // Only write if content changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Removed console.log statements from ${filePath}`);
    return true;
  }
  return false;
}

// Main function
function main() {
  console.log('Starting to clean up console.log statements...');
  let totalProcessed = 0;
  let totalChanged = 0;
  
  for (const dir of DIRECTORIES) {
    if (!fs.existsSync(dir)) {
      console.log(`Directory ${dir} does not exist, skipping...`);
      continue;
    }
    
    const files = getFilesInDirectory(dir);
    totalProcessed += files.length;
    
    for (const file of files) {
      if (processFile(file)) {
        totalChanged++;
      }
    }
  }
  
  console.log(`Processed ${totalProcessed} files, modified ${totalChanged} files.`);
  console.log('Cleanup complete!');
}

main(); 