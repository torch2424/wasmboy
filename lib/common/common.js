// Common Static functions

// Function to get performance timestamp
// This is to support node vs. Browser
export const getPerformanceTimestamp = () => {
  if (typeof window !== 'undefined') {
    return performance.now();
  }
  return Date.now();
};
