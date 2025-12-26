/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // Rewrite /uploads/* to /api/uploads/* for dynamic file serving
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ]
  },
}

module.exports = nextConfig

