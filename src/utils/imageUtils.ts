/**
 * Compresses an image file by resizing it while maintaining aspect ratio.
 * @param file - The original File object.
 * @param maxWidth - Maximum width allowed.
 * @param maxHeight - Maximum height allowed.
 * @param quality - JPEG quality (0.0 to 1.0).
 * @returns A Promise resolving to a new (compressed) File object.
 */
export const compressImage = (
    file: File,
    maxWidth: number,
    maxHeight: number,
    quality: number
): Promise<File> => {
    return new Promise((resolve, reject) => {
        console.log(`Starting compression: ${file.name}, size: ${file.size}, max: ${maxWidth}x${maxHeight}, q: ${quality}`);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let { width, height } = img;
                console.log(`Original dimensions: ${width}x${height}`);

                // Calculate new dimensions
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }
                console.log(`New dimensions: ${width}x${height}`);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            console.log(`Blob created. Size: ${blob.size}`);
                            // Change extension to .jpg
                            const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                            const newFile = new File([blob], newName, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(newFile);
                        } else {
                            reject(new Error('Canvas to Blob conversion failed'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = (err) => {
                console.error('Image load error', err);
                reject(err);
            };
        };
        reader.onerror = (err) => {
            console.error('FileReader error', err);
            reject(err);
        };
    });
};
