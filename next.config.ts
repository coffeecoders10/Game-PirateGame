import type { NextConfig } from "next";

const BASE_PATH = "/pirate-game";

const nextConfig: NextConfig = {
  /* config options here */
  basePath: BASE_PATH,
  // Exposed so unoptimized <Image> srcs (which skip basePath) can be prefixed.
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  images: { unoptimized: true },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;


// LOCAL ONLY

// import type { NextConfig } from "next";


// const nextConfig: NextConfig = {
//   images: { unoptimized: true },
//   cacheComponents: true,
//   partialPrefetching: true,
// };

// export default nextConfig;

