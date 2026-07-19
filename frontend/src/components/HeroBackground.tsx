import { useState, useEffect } from 'react';

const IMAGES = [
  '/hero/scenery-1.jpg',
  '/hero/scenery-2.jpg',
];

export default function HeroBackground() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Preload images on mount
  useEffect(() => {
    IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Cycle images every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 w-full h-full z-0 overflow-hidden"
    >
      {IMAGES.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            idx === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      
      {/* Dark gradient scrim overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/10" />
    </div>
  );
}
