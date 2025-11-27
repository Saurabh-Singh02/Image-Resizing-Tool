// DOM Elements
const imageUpload = document.getElementById('imageUpload');
const uploadBtn = document.getElementById('uploadBtn');
const cropBtn = document.getElementById('cropBtn');
const resetCropBtn = document.getElementById('resetCropBtn');
const compressBtn = document.getElementById('compressBtn');
const downloadBtn = document.getElementById('downloadBtn');
const imageToCrop = document.getElementById('imageToCrop');
const finalPreview = document.getElementById('finalPreview');
const aspectRatio = document.getElementById('aspectRatio');
const targetSize = document.getElementById('targetSize');
const compressionMethod = document.getElementById('compressionMethod');
const originalSize = document.getElementById('originalSize');
const newSize = document.getElementById('newSize');
const sizeReduction = document.getElementById('sizeReduction');
const compressionProgress = document.getElementById('compressionProgress');
const compressionPercent = document.getElementById('compressionPercent');
const compressionStatus = document.getElementById('compressionStatus');
const visitorCount = document.getElementById('visitorCount');
const footerVisitorCount = document.getElementById('footerVisitorCount');

const cropCard = document.getElementById('cropCard');
const previewCard = document.getElementById('previewCard');
const cropControlsCard = document.getElementById('cropControlsCard');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

// Variables
let cropper;
let originalImageFile;
let originalImageSize = 0;
let croppedCanvas;
let finalBlob;

// Visitor Counter Functionality
function updateVisitorCount() {
    // Check if we're in a browser environment
    if (typeof localStorage !== 'undefined') {
        // Get current count from localStorage or initialize to 0
        let count = localStorage.getItem('visitorCount');
        
        if (!count) {
            // First visit - initialize counter
            count = 1;
        } else {
            // Increment counter
            count = parseInt(count) + 1;
        }
        
        // Save updated count to localStorage
        localStorage.setItem('visitorCount', count.toString());
        
        // Update the display
        visitorCount.textContent = count;
        footerVisitorCount.textContent = count;
    } else {
        // Fallback if localStorage is not available
        visitorCount.textContent = 'N/A';
        footerVisitorCount.textContent = 'N/A';
    }
}

// Initialize visitor counter when page loads
document.addEventListener('DOMContentLoaded', function() {
    updateVisitorCount();
});

// Event Listeners
imageUpload.addEventListener('change', handleImageUpload);
uploadBtn.addEventListener('click', initCropper);
cropBtn.addEventListener('click', applyCrop);
resetCropBtn.addEventListener('click', resetCropper);
compressBtn.addEventListener('click', compressToTargetSize);
downloadBtn.addEventListener('click', downloadImage);
aspectRatio.addEventListener('change', updateAspectRatio);

// Functions
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        // Validate file type
        if (!file.type.match('image.*')) {
            alert('Please select an image file (JPEG, PNG, etc.)');
            return;
        }
        
        originalImageFile = file;
        originalImageSize = file.size;
        
        // Enable upload button
        uploadBtn.disabled = false;
        
        // Show original size
        originalSize.textContent = formatFileSize(originalImageSize);
    }
}

function initCropper() {
    if (!originalImageFile) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        imageToCrop.src = e.target.result;
        
        // Show crop section
        cropCard.classList.remove('hidden');
        cropControlsCard.classList.remove('hidden');
        previewCard.classList.add('hidden');
        
        // Update steps
        step1.classList.remove('active');
        step1.classList.add('completed');
        step2.classList.add('active');
        
        // Initialize cropper
        if (cropper) {
            cropper.destroy();
        }
        
        cropper = new Cropper(imageToCrop, {
            aspectRatio: NaN, // Free ratio by default
            viewMode: 1,
            autoCropArea: 0.8,
            responsive: true,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    };
    reader.readAsDataURL(originalImageFile);
}

function applyCrop() {
    if (!cropper) return;
    
    // Get cropped canvas
    croppedCanvas = cropper.getCroppedCanvas();
    
    // Create URL for the blob
    const url = croppedCanvas.toDataURL('image/jpeg', 0.9);
    
    // Set the final preview
    finalPreview.src = url;
    
    // Show preview section
    previewCard.classList.remove('hidden');
    
    // Update steps
    step2.classList.remove('active');
    step2.classList.add('completed');
    step3.classList.add('active');
    
    // Reset compression UI
    compressionProgress.style.width = '0%';
    compressionPercent.textContent = '0%';
    compressionStatus.textContent = 'Ready to compress';
    downloadBtn.disabled = true;
    
    // Calculate and display size info for initial crop
    const initialSize = Math.round((url.length * 3) / 4); // Approximate base64 size
    newSize.textContent = formatFileSize(initialSize);
    
    const reduction = ((originalImageSize - initialSize) / originalImageSize * 100).toFixed(1);
    sizeReduction.textContent = `${reduction}%`;
}

function resetCropper() {
    if (cropper) {
        cropper.reset();
    }
}

function compressToTargetSize() {
    if (!croppedCanvas) return;
    
    const targetSizeKB = parseInt(targetSize.value);
    if (isNaN(targetSizeKB) || targetSizeKB < 10 || targetSizeKB > 500) {
        alert('Please enter a valid target size between 10 and 500 KB');
        return;
    }
    
    const targetSizeBytes = targetSizeKB * 1024;
    const method = compressionMethod.value;
    
    // Reset UI
    compressionProgress.style.width = '0%';
    compressionPercent.textContent = '0%';
    downloadBtn.disabled = true;
    
    if (method === 'quality') {
        compressWithQuality(targetSizeBytes);
    } else {
        compressToExactSize(targetSizeBytes);
    }
}

function compressWithQuality(targetSizeBytes) {
    compressionStatus.textContent = 'Compressing with quality adjustment...';
    
    // Start with high quality and reduce until we hit the target size
    let quality = 0.9;
    let blob;
    let attempts = 0;
    const maxAttempts = 20;
    
    function attemptCompression() {
        attempts++;
        
        // Update progress
        const progress = Math.min(90, (attempts / maxAttempts) * 90);
        compressionProgress.style.width = `${progress}%`;
        compressionPercent.textContent = `${Math.round(progress)}%`;
        
        croppedCanvas.toBlob(function(resultBlob) {
            blob = resultBlob;
            
            if (blob.size <= targetSizeBytes || attempts >= maxAttempts || quality <= 0.1) {
                // We've reached our target or max attempts
                finishCompression(blob);
            } else {
                // Reduce quality and try again
                quality -= 0.05;
                setTimeout(attemptCompression, 50);
            }
        }, 'image/jpeg', quality);
    }
    
    attemptCompression();
}

function compressToExactSize(targetSizeBytes) {
    compressionStatus.textContent = 'Compressing to exact size...';
    
    // Use binary search to find the optimal quality
    let minQuality = 0.1;
    let maxQuality = 1.0;
    let quality = 0.5;
    let bestBlob = null;
    let attempts = 0;
    const maxAttempts = 15;
    
    function attemptCompression() {
        attempts++;
        
        // Update progress
        const progress = Math.min(90, (attempts / maxAttempts) * 90);
        compressionProgress.style.width = `${progress}%`;
        compressionPercent.textContent = `${Math.round(progress)}%`;
        
        croppedCanvas.toBlob(function(blob) {
            if (attempts >= maxAttempts) {
                finishCompression(bestBlob || blob);
                return;
            }
            
            if (Math.abs(blob.size - targetSizeBytes) < targetSizeBytes * 0.05) {
                // Close enough to target
                finishCompression(blob);
            } else if (blob.size > targetSizeBytes) {
                // Too big, reduce quality
                maxQuality = quality;
                quality = (minQuality + quality) / 2;
                setTimeout(attemptCompression, 50);
            } else {
                // Too small, increase quality
                bestBlob = blob; // Keep the best one so far
                minQuality = quality;
                quality = (quality + maxQuality) / 2;
                setTimeout(attemptCompression, 50);
            }
        }, 'image/jpeg', quality);
    }
    
    attemptCompression();
}

function finishCompression(blob) {
    if (!blob) return;
    
    // Create URL for the blob
    const url = URL.createObjectURL(blob);
    finalBlob = blob;
    
    // Update the preview
    finalPreview.src = url;
    
    // Update size info
    const newImageSize = blob.size;
    newSize.textContent = formatFileSize(newImageSize);
    
    const reduction = ((originalImageSize - newImageSize) / originalImageSize * 100).toFixed(1);
    sizeReduction.textContent = `${reduction}%`;
    
    // Update UI
    compressionProgress.style.width = '100%';
    compressionPercent.textContent = '100%';
    compressionStatus.textContent = `Compression complete! Final size: ${formatFileSize(newImageSize)}`;
    downloadBtn.disabled = false;
    
    // Store the blob for download
    finalPreview.dataset.blobUrl = url;
}

function downloadImage() {
    if (!finalPreview.dataset.blobUrl) return;
    
    const a = document.createElement('a');
    a.href = finalPreview.dataset.blobUrl;
    a.download = 'exam-photo.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function updateAspectRatio() {
    if (!cropper) return;
    
    const ratio = aspectRatio.value;
    if (ratio === 'free') {
        cropper.setAspectRatio(NaN);
    } else {
        cropper.setAspectRatio(eval(ratio));
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' bytes';
    } else if (bytes < 1048576) {
        return (bytes / 1024).toFixed(2) + ' KB';
    } else {
        return (bytes / 1048576).toFixed(2) + ' MB';
    }
}