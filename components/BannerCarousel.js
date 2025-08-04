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
          className={`w-full h-auto object-cover transition-opacity duration-700 ${
            idx === current ? 'opacity-100' : 'opacity-0 absolute inset-0'
          }`}
        />
      ))}
    </div>
  );
}
import { useState, useEffect } from 'react';

const banners = [
  {
    id: 1,
    title: "Welcome Bonus",
    description: "Get $100 bonus when you complete your first challenge!",
    image: "/banners/banner1.jpg",
    bgColor: "from-blue-600 to-purple-600"
  },
  {
    id: 2,
    title: "Challenge Mode",
    description: "Prove your skills with zero risk betting challenges",
    image: "/banners/banner2.jpg", 
    bgColor: "from-green-600 to-blue-600"
  },
  {
    id: 3,
    title: "Leaderboard",
    description: "Compete with other traders for the top spot",
    image: "/banners/banner3.jpg",
    bgColor: "from-purple-600 to-pink-600"
  }
];

export default function BannerCarousel() {
  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="overflow-hidden rounded-2xl">
        <div 
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentBanner * 100}%)` }}
        >
          {banners.map((banner) => (
            <div
              key={banner.id}
              className={`w-full flex-shrink-0 bg-gradient-to-r ${banner.bgColor} p-8 text-center text-white`}
            >
              <h3 className="text-2xl font-bold mb-2">{banner.title}</h3>
              <p className="text-lg opacity-90">{banner.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center mt-4 space-x-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentBanner(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              currentBanner === index 
                ? 'bg-white' 
                : 'bg-white/50 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
