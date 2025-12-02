/**
 * Implements a fade-in effect for elements as they enter the viewport.
 * Elements with the "try-fade-in" class are transitioned to visible using
 * the IntersectionObserver API.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

// Waits for the DOM to be fully loaded before initializing the fade-in logic.
document.addEventListener('DOMContentLoaded', () => {
  // Select all elements with the class "try-fade-in".
  // These elements will be converted to "fade-in-item" for the fade-in effect.
  [].forEach.call(document.getElementsByClassName('try-fade-in'), (item) => {
    // Remove the "try-fade-in" class to prevent duplicate processing.
    item.classList.remove('try-fade-in');
    // Add the "fade-in-item" class to mark the element for fade-in animation.
    item.classList.add('fade-in-item');
  });

  // Create an IntersectionObserver to monitor elements entering the viewport.
  // The observer triggers the fade-in animation when elements intersect.
  const observer = new IntersectionObserver((entries) => {
    // Iterate through all observed entries.
    entries.forEach((entry) => {
      // Check if the element is currently intersecting the viewport.
      if (entry.isIntersecting) {
        // Add the "fade-in" class to trigger the CSS animation.
        entry.target.classList.add('fade-in');
        // Remove the "fade-in-item" class to prevent re-triggering.
        entry.target.classList.remove('fade-in-item');
      }
    });
  });

  // Observe all elements with the "fade-in-item" class.
  // These elements will trigger the fade-in effect when they intersect.
  [].forEach.call(document.getElementsByClassName('fade-in-item'), (item) => {
    // Register the element with the IntersectionObserver.
    observer.observe(item);
  });
});
