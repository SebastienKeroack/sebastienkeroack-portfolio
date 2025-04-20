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
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

document.addEventListener("DOMContentLoaded", () => {
  // Select all elements with the class "try-fade-in".
  // These elements will be converted to "fade-in-item" for the fade-in effect.
  [].forEach.call(document.getElementsByClassName("try-fade-in"), (item) => {
    item.classList.remove("try-fade-in");
    item.classList.add("fade-in-item");
  });

  // Create an IntersectionObserver to monitor elements entering the viewport.
  // The observer triggers the fade-in animation when elements intersect.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("fade-in");
        entry.target.classList.remove("fade-in-item");
      }
    });
  });

  // Observe all elements with the "fade-in-item" class.
  // These elements will trigger the fade-in effect when they intersect.
  [].forEach.call(document.getElementsByClassName("fade-in-item"), (item) => {
    observer.observe(item);
  });
});
