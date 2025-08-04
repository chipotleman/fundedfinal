
import React, { useState, useEffect } from 'react';

const banners = [
  '/banners/banner1.jpg',
  '/banners/banner2.jpg',
  '/banners/banner3.jpg'
];

export default function BannerCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000); // change every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-hidden relative rounded-lg">
      {banners.map((src, idx) => (
        <img
          key={idx}
          src={src}
          alt={`Banner ${idx + 1}`}
          className={`w-full h-32 object-cover transition-opacity duration-1000 ${
            idx === current ? 'opacity-100' : 'opacity-0 absolute top-0 left-0'
          }`}
        />
      ))}
      
      {/* Dots indicator */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {banners.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`w-2 h-2 rounded-full transition-colors ${
              idx === current ? 'bg-white' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
