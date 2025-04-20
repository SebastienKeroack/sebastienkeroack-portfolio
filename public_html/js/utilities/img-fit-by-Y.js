/**
 * This script ensures visual consistency by dynamically adjusting the height of
 * all images with the class 'fit-by-Y'. It calculates the smallest height among
 * the images and scales all others to match it, maintaining their aspect ratio.
 * The adjustment is performed on page load and whenever the browser window is
 * resized, ensuring responsiveness and uniformity across different screen sizes
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

document.addEventListener("DOMContentLoaded", () => {
  // Function to adjust image heights
  const adjustImageHeights = () => {
    // Select all images with the class 'fit-by-Y'
    const images = Array.from(document.querySelectorAll("img.fit-by-Y"));

    if (images.length === 0) return;

    // Get the computed height of each image
    const heights = images.map((img) => img.getBoundingClientRect().height);

    // Find the lowest height
    const minY = Math.min(...heights);

    // Scale all images to the lowest height
    images.forEach((img) => {
      img.style.height = `${minY}px`;
    });
  };

  // Execute on page load
  adjustImageHeights();

  // Execute on window resize
  window.addEventListener("resize", adjustImageHeights);
});
